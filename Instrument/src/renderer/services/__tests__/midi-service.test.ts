import { describe, expect, it, vi } from "vitest";
import MidiService from "../midi-service";

// Small, but the only test that can catch "we send on the wrong channel" or "we latched onto
// the wrong port". Stubbing navigator.requestMIDIAccess is an environment concern - jsdom has
// no Web MIDI at all - not module mocking; MidiService itself is the real one.

const fakeOutput = (name: string) => ({ name, send: vi.fn() });

const midiAccessWith = (...outputs: ReturnType<typeof fakeOutput>[]) => {
    Object.defineProperty(navigator, "requestMIDIAccess", {
        value: vi.fn().mockResolvedValue({
            outputs: new Map(outputs.map((output, index) => [String(index), output]))
        }),
        configurable: true,
        writable: true
    });
    return outputs;
};

describe("sending to the DAW", () => {
    it("sends control changes on the channel the instrument listens on", async () => {
        // 0xB1 is control change on channel 2. The Python instrument asks mido for channel=1
        // on its zero-based numbering, which is the same wire byte. Change one, change both.
        const [adaptizer] = midiAccessWith(fakeOutput("Adaptizer"));
        await MidiService.requestMIDIAccess();

        MidiService.sendMidiMessage(7, 42);

        expect(adaptizer.send).toHaveBeenCalledWith([0xB1, 7, 42]);
    });
});

describe("finding the loopMIDI port", () => {
    it("takes the port named exactly Adaptizer", async () => {
        const [, adaptizer] = midiAccessWith(fakeOutput("Microsoft GS Wavetable Synth"), fakeOutput("Adaptizer"));
        await MidiService.requestMIDIAccess();

        MidiService.sendMidiMessage(1, 0);

        expect(MidiService.isOutputMissing()).toBe(false);
        expect(adaptizer.send).toHaveBeenCalledWith([0xB1, 1, 0]);
    });

    it("does not settle for a port whose name merely starts the same", async () => {
        // "Adaptizer 2" is what a second loopMIDI port gets called. Sending to it would look
        // like it works and reach nothing the exported song was rendered against.
        const [nearMiss] = midiAccessWith(fakeOutput("Adaptizer 2"));
        await MidiService.requestMIDIAccess();

        MidiService.sendMidiMessage(1, 64);

        expect(MidiService.isOutputMissing()).toBe(true);
        expect(nearMiss.send).not.toHaveBeenCalled();
    });

    it("ignores sends while the port is missing rather than throwing", async () => {
        midiAccessWith();
        await MidiService.requestMIDIAccess();

        expect(() => MidiService.sendMidiMessage(1, 64)).not.toThrow();
        expect(MidiService.isOutputMissing()).toBe(true);
    });
});
