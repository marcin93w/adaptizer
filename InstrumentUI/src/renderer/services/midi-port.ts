// What the app needs from the DAW-facing MIDI port. Implemented for real by MidiService
// (Web MIDI, over the loopMIDI port named "Adaptizer") and in memory by
// src/testing/fake-midi-port.ts, so tests can assert on what the DAW actually received.
export interface MidiPort {
    requestMIDIAccess(): Promise<void>;
    isOutputMissing(): boolean;
    sendMidiMessage(controlNumber: number, midiValue: number): void;
}
