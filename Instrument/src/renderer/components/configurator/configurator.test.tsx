import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Configurator from "./configurator";
import Project from "../../domain/project";
import { createFakeElectronApi, FakeElectronApi } from "../../../testing/fake-electron-api";
import { createFakeMidiPort, FakeMidiPort } from "../../../testing/fake-midi-port";
import { aControl, aProject } from "../../../testing/project-builders";

// The configurator is the audition: everything the user does to a control here is supposed to
// reach the DAW, and reach it at the right moment. The fine-grained send rules belong to the
// adaptizer's own tests; what this one holds is that the wiring between the screen and the
// port exists at all, and that switching projects leaves exactly one of everything behind.

const setUp = async (project: Project = aProject({ controls: [aControl({ cc: 1 })] })) => {
    const midi = createFakeMidiPort();
    const api = createFakeElectronApi();
    let view!: ReturnType<typeof render>;
    await act(async () => {
        view = render(<Configurator project={project} midiPort={midi} electronApi={api} />);
    });

    const showProject = async (other: Project) => {
        await act(async () => {
            view.rerender(<Configurator project={other} midiPort={midi} electronApi={api} />);
        });
    };

    return { midi, api, showProject };
};

// The selected control's curve and the control list both print "CC 3", so presence is the
// question this can answer, not how many times it appears.
const isControlOnScreen = (controlNumber: number) =>
    screen.queryAllByText(`CC ${controlNumber}`).length > 0;

/** Retype the MIDI value of the breakpoint the curve editor has selected. */
const setSelectedPointMidi = (midi: string) =>
    fireEvent.change(screen.getByLabelText("MIDI"), { target: { value: midi } });

const settleDebounce = async () => {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
    });
};

const openExportDialog = async (api: FakeElectronApi) => {
    await act(async () => api.emitExportRequested());
};

const isExportDialogOpen = () => screen.queryByText("Export Ableton project") !== null;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("auditioning a control", () => {
    it("sends what the user shaped once they stop shaping it", async () => {
        const { midi } = await setUp();
        midi.take();

        // The knob starts at input 0, so the breakpoint sitting there is what the DAW is hearing
        setSelectedPointMidi("100");

        expect(midi.take()).toEqual([]);
        await settleDebounce();
        expect(midi.take()).toEqual([{ controlNumber: 1, value: 100 }]);
    });

    it("adds a control the DAW can hear at once, without touching the configured ones", async () => {
        // CC 1 and CC 3 with a gap between them: numbering from the count handed out 3 again
        const { midi } = await setUp(aProject({ controls: [aControl({ cc: 1 }), aControl({ cc: 3 })] }));
        midi.take();

        fireEvent.click(screen.getByText("+ Add control"));

        expect(isControlOnScreen(3)).toBe(true);
        expect(isControlOnScreen(4)).toBe(true);
        expect(midi.take()).toEqual([{ controlNumber: 4, value: 0 }]);
    });
});

describe("choosing the dimension the song adapts to", () => {
    it("offers every dimension the player can deliver, and nothing else", async () => {
        await setUp();

        expect(screen.getAllByRole("radio").map(option => option.textContent))
            .toEqual(["Volume", "Heart rate", "Movement speed", "Intensity"]);
    });

    it("names the curve after the chosen dimension, so the axis says what it is", async () => {
        await setUp();

        fireEvent.click(screen.getByRole("radio", { name: "Heart rate" }));

        expect(screen.getByRole("group", { name: "Heart rate to MIDI control curve" })).toBeInTheDocument();
    });
});

describe("opening another project", () => {
    it("replaces the controls and ends the export the old project started", async () => {
        const { api, showProject } = await setUp();
        await openExportDialog(api);
        expect(isExportDialogOpen()).toBe(true);

        await showProject(aProject({ controls: [aControl({ cc: 7 })] }));

        expect(isControlOnScreen(7)).toBe(true);
        expect(isControlOnScreen(1)).toBe(false);
        expect(isExportDialogOpen()).toBe(false);
    });

    it("leaves exactly one live connection to the DAW", async () => {
        // Two adaptizers over the same controls is invisible on screen and audible only as
        // duplicated traffic, so the count of messages for one edit is what pins it.
        const { midi, showProject } = await setUp();

        await showProject(aProject({ controls: [aControl({ cc: 7 })] }));
        midi.take();
        setSelectedPointMidi("100");
        await settleDebounce();

        expect(midi.take()).toEqual([{ controlNumber: 7, value: 100 }]);
    });
});
