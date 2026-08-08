import { describe, expect, it } from "vitest";
import { createFakeMidiPort } from "../fake-midi-port";

// A fake that lies is worse than no fake, so the rules it promises to mirror from
// MidiService get their own tests. Player/mobile does the same for mockAdaptiveAudio.

describe("the fake MIDI port", () => {
    it("records what the DAW received, in order", () => {
        const port = createFakeMidiPort();

        port.sendMidiMessage(1, 64);
        port.sendMidiMessage(3, 127);

        expect(port.sent).toEqual([
            { controlNumber: 1, value: 64 },
            { controlNumber: 3, value: 127 }
        ]);
        expect(port.lastValueFor(1)).toBe(64);
        expect(port.lastValueFor(9)).toBeUndefined();
    });

    it("drops sends while the port is missing rather than recording them", () => {
        // MidiService silently no-ops with no output handle. Recording those would let a
        // test assert on messages that never reach a real DAW.
        const port = createFakeMidiPort({ portPresent: false });

        port.sendMidiMessage(1, 64);

        expect(port.sent).toEqual([]);
        expect(port.dropped).toBe(1);
    });

    it("only notices the port appearing when the app checks again", async () => {
        // This is what makes the connection warning's refresh button meaningful.
        const port = createFakeMidiPort({ portPresent: false });
        await port.requestMIDIAccess();
        expect(port.isOutputMissing()).toBe(true);

        port.setPortPresent(true);
        expect(port.isOutputMissing()).toBe(true);
    });

    it("reports the port as present once the app re-checks", async () => {
        const port = createFakeMidiPort({ portPresent: false });
        await port.requestMIDIAccess();

        port.setPortPresent(true);
        await port.requestMIDIAccess();

        expect(port.isOutputMissing()).toBe(false);
        expect(port.accessRequests).toBe(2);
    });

    it("can refuse MIDI access outright", async () => {
        const port = createFakeMidiPort();
        port.failNextAccessRequest();

        await expect(port.requestMIDIAccess()).rejects.toThrow();
        // Only the next one fails
        await expect(port.requestMIDIAccess()).resolves.toBeUndefined();
    });

    it("hands back only the messages since the last take", () => {
        const port = createFakeMidiPort();

        port.sendMidiMessage(1, 10);
        expect(port.take()).toEqual([{ controlNumber: 1, value: 10 }]);

        port.sendMidiMessage(1, 20);
        expect(port.take()).toEqual([{ controlNumber: 1, value: 20 }]);
        expect(port.take()).toEqual([]);
    });
});
