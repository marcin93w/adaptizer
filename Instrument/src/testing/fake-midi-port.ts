import { MidiPort } from "../renderer/services/midi-port";

// An in-memory stand-in for the loopMIDI port named "Adaptizer", so tests can assert on
// what the DAW actually received instead of on which method was called.
//
// Two rules it deliberately mirrors from MidiService:
//   - A send while the port is missing is DROPPED, not recorded. The real service silently
//     no-ops, and a fake that recorded those would let tests assert on messages that never
//     reach a real DAW. The `dropped` counter is there so a test can still say "we tried
//     and nothing went out".
//   - setPortPresent() takes effect on the NEXT requestMIDIAccess(). MidiService only
//     updates its missing flag inside that call, which is why the connection warning needs
//     its refresh button.
//
// One divergence, stated so it is not mistaken for an oversight: the real service also
// drops sends before the first successful requestMIDIAccess(), because it has no output
// handle yet. That is a startup race in the Web MIDI handshake, not a rule of the domain,
// and it belongs to the component layer where initialize() and the effect ordering live.
// Here, delivery depends only on whether the port is present.

export interface SentControlChange {
    controlNumber: number;
    value: number;
}

export interface FakeMidiPort extends MidiPort {
    /** Every CC message that reached the DAW, oldest first. */
    readonly sent: readonly SentControlChange[];
    /** Messages since the last take() - for step-by-step scenarios. */
    take(): SentControlChange[];
    /** The last value sent for a CC, or undefined if it never was. */
    lastValueFor(controlNumber: number): number | undefined;
    /** How many times the app re-checked for the port. */
    readonly accessRequests: number;
    /** Messages the app tried to send while the port was missing. */
    readonly dropped: number;

    /** Drive the loopMIDI-not-running state. Takes effect on the next access request. */
    setPortPresent(present: boolean): void;
    /** Make the browser refuse MIDI access - the app must treat that as no port. */
    failNextAccessRequest(error?: Error): void;
}

export const createFakeMidiPort = (options: { portPresent?: boolean } = {}): FakeMidiPort => {
    let portPresent = options.portPresent ?? true;
    let outputMissing = !portPresent;
    let accessRequests = 0;
    let dropped = 0;
    let nextAccessError: Error | null = null;
    let sent: SentControlChange[] = [];
    let taken = 0;

    return {
        get sent() {
            return sent;
        },
        get accessRequests() {
            return accessRequests;
        },
        get dropped() {
            return dropped;
        },

        async requestMIDIAccess() {
            accessRequests++;
            if (nextAccessError) {
                const error = nextAccessError;
                nextAccessError = null;
                throw error;
            }
            outputMissing = !portPresent;
        },

        isOutputMissing() {
            return outputMissing;
        },

        sendMidiMessage(controlNumber: number, value: number) {
            if (!portPresent) {
                dropped++;
                return;
            }
            sent.push({ controlNumber, value });
        },

        take() {
            const since = sent.slice(taken);
            taken = sent.length;
            return since;
        },

        lastValueFor(controlNumber: number) {
            for (let i = sent.length - 1; i >= 0; i--) {
                if (sent[i].controlNumber === controlNumber) {
                    return sent[i].value;
                }
            }
            return undefined;
        },

        setPortPresent(present: boolean) {
            portPresent = present;
        },

        failNextAccessRequest(error = new Error("MIDI access refused")) {
            nextAccessError = error;
        }
    };
};
