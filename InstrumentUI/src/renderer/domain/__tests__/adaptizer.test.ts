import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Adaptizer from "../adaptizer";
import { createFakeMidiPort, FakeMidiPort } from "../../../testing/fake-midi-port";
import { aControl, aProject } from "../../../testing/project-builders";

// The Adaptizer is what stands between the user's controls and the DAW. Every assertion
// below is against the messages the fake port received - what the DAW would actually
// hear - rather than against which method was called.

let midi: FakeMidiPort;

beforeEach(() => {
    vi.useFakeTimers();
    midi = createFakeMidiPort();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("connecting a project to the DAW", () => {
    it("puts the DAW in sync with every control straight away", () => {
        const project = aProject({
            controls: [
                aControl({ cc: 1 }),
                aControl({ cc: 2, points: [{ input: 0, midi: 127 }, { input: 9, midi: 0 }] })
            ]
        });

        new Adaptizer(project, 0, midi);

        expect(midi.sent).toEqual([
            { controlNumber: 1, value: 0 },
            { controlNumber: 2, value: 127 }
        ]);
    });

    it("announces a newly added control to the DAW", () => {
        // Adding a control is the only thing that puts its CC on the wire - the "+" button
        // sets the selection directly rather than going through sendControl - so without
        // this the DAW has nothing to latch its MIDI learn onto until the curve is edited.
        // Whether it goes out immediately or after the debounce is not asserted; these are
        // control parameters, not notes, so the timing is not something anyone perceives.
        const project = aProject({ controls: [aControl({ cc: 1 })] });
        new Adaptizer(project, 3, midi);
        midi.take();

        project.addControl(aControl({ cc: 5 }));
        vi.advanceTimersByTime(300);

        expect(midi.take()).toEqual([{ controlNumber: 5, value: 42 }]);
    });
});

describe("editing a control", () => {
    it("does not flood the port while a curve point is being dragged", () => {
        // The SVG editor fires on every changed pointer position. Without the debounce each one would
        // become a CC message and the DAW would be swamped mid-gesture.
        const project = aProject({ controls: [aControl({ cc: 1 })] });
        new Adaptizer(project, 9, midi);
        midi.take();
        const control = project.getControls()[0];

        for (const midiMax of [100, 90, 80, 70, 60]) {
            control.movePoint(9, 9, midiMax);
            vi.advanceTimersByTime(50);
        }

        expect(midi.take()).toEqual([]);
    });

    it("sends the value the user settled on once they stop", () => {
        const project = aProject({ controls: [aControl({ cc: 1 })] });
        new Adaptizer(project, 9, midi);
        midi.take();
        const control = project.getControls()[0];

        for (const midiMax of [100, 90, 80, 70, 60]) {
            control.movePoint(9, 9, midiMax);
            vi.advanceTimersByTime(50);
        }
        vi.advanceTimersByTime(250);

        expect(midi.take()).toEqual([{ controlNumber: 1, value: 60 }]);
    });

    it("lets two controls edited at the same time both through", () => {
        // One shared debounce would drop whichever control was edited first
        const project = aProject({
            controls: [aControl({ cc: 1 }), aControl({ cc: 2 })]
        });
        new Adaptizer(project, 9, midi);
        midi.take();
        const [first, second] = project.getControls();

        first.movePoint(9, 9, 100);
        second.movePoint(9, 9, 50);
        vi.advanceTimersByTime(300);

        expect(midi.take()).toEqual([
            { controlNumber: 1, value: 100 },
            { controlNumber: 2, value: 50 }
        ]);
    });

});

describe("turning the knob", () => {
    it("sends every control immediately, because the audition has to feel live", () => {
        const project = aProject({
            controls: [
                aControl({ cc: 1 }),
                aControl({ cc: 2, points: [{ input: 0, midi: 127 }, { input: 9, midi: 0 }] })
            ]
        });
        const adaptizer = new Adaptizer(project, 0, midi);
        midi.take();

        adaptizer.setInput(9);

        // No timer advanced - these are already out
        expect(midi.take()).toEqual([
            { controlNumber: 1, value: 127 },
            { controlNumber: 2, value: 0 }
        ]);
    });

    it("walks the controls through the values the export will render", () => {
        const project = aProject({ controls: [aControl({ cc: 1 })] });
        const adaptizer = new Adaptizer(project, 0, midi);
        midi.take();

        for (let input = 0; input <= 9; input++) {
            adaptizer.setInput(input);
        }

        expect(midi.take().map(message => message.value))
            .toEqual([0, 14, 28, 42, 56, 71, 85, 99, 113, 127]);
    });
});

describe("selecting a control", () => {
    it("re-announces it so the DAW can learn the CC", () => {
        // This is the documented "MIDI learn" affordance - clicking a control makes it
        // speak so the DAW can map it. It looks like a stray call; it is a feature.
        const project = aProject({ controls: [aControl({ cc: 4 })] });
        const adaptizer = new Adaptizer(project, 9, midi);
        midi.take();

        adaptizer.sendControl(project.getControls()[0]);

        expect(midi.take()).toEqual([{ controlNumber: 4, value: 127 }]);
    });
});

describe("closing a project", () => {
    it("does not let an edit made just before it land on the DAW afterwards", () => {
        // Opening another project while an edit is still inside the debounce window: the
        // value belongs to a project that is no longer open, so it must not be sent.
        const project = aProject({ controls: [aControl({ cc: 1 })] });
        const adaptizer = new Adaptizer(project, 9, midi);
        midi.take();

        project.getControls()[0].movePoint(9, 9, 60);
        adaptizer.dispose();
        vi.advanceTimersByTime(300);

        expect(midi.take()).toEqual([]);
    });

    it("leaves exactly one adaptizer talking to the DAW when it is replaced", () => {
        const project = aProject({ controls: [aControl({ cc: 1 })] });
        const replaced = new Adaptizer(project, 9, midi);
        replaced.dispose();
        new Adaptizer(project, 9, midi);
        midi.take();

        project.getControls()[0].movePoint(9, 9, 60);
        vi.advanceTimersByTime(300);

        expect(midi.take()).toEqual([{ controlNumber: 1, value: 60 }]);
    });

    it("stops announcing controls added to a project it no longer serves", () => {
        const project = aProject({ controls: [aControl({ cc: 1 })] });
        const adaptizer = new Adaptizer(project, 9, midi);
        adaptizer.dispose();
        midi.take();

        project.addControl(aControl({ cc: 5 }));
        vi.advanceTimersByTime(300);

        expect(midi.take()).toEqual([]);
    });
});

describe("reporting whether the DAW can be reached", () => {
    it("says the port is available when loopMIDI is running", async () => {
        const adaptizer = new Adaptizer(aProject(), 0, midi);

        await expect(adaptizer.isPortAvailable()).resolves.toBe(true);
    });

    it("says it is not when the port has gone away", async () => {
        const adaptizer = new Adaptizer(aProject(), 0, midi);
        midi.setPortPresent(false);

        await expect(adaptizer.isPortAvailable()).resolves.toBe(false);
    });

    it("says it is not when the browser refuses MIDI access altogether", async () => {
        const adaptizer = new Adaptizer(aProject(), 0, midi);
        midi.failNextAccessRequest();

        await expect(adaptizer.isPortAvailable()).resolves.toBe(false);
    });

    it("checks again rather than trusting the answer from when the project loaded", async () => {
        const adaptizer = new Adaptizer(aProject(), 0, midi);
        await adaptizer.initialize();

        midi.setPortPresent(false);

        expect(await adaptizer.isPortAvailable()).toBe(false);
    });
});
