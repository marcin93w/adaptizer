import Project from "./project";
import { Control } from "./control";
import { MidiPort } from "../services/midi-port";

class Adaptizer {
    private _input: number;
    private readonly _pendingSends = new Map<Control, ReturnType<typeof setTimeout>>();

    constructor(private _project: Project, initialInput: number, private readonly _midiPort: MidiPort) {
        this._input = initialInput;
        this._project.getControls().forEach((control: Control) => {
            this.sendNowAndOnEveryControlChange(control);
        });
        this._project.registerControlAddedListener((control: Control) => {
            this.sendNowAndOnEveryControlChange(control);
        });
    }

    async initialize() {
        await this._midiPort.requestMIDIAccess();
    }

    // The port is only looked up when a project is loaded, so an export that depends on
    // it having stayed there has to ask again rather than trusting the earlier answer
    async isPortAvailable(): Promise<boolean> {
        try {
            await this._midiPort.requestMIDIAccess();
            return !this._midiPort.isOutputMissing();
        } catch {
            return false;
        }
    }

    private sendNowAndOnEveryControlChange(control: Control) {
        this._calculateAndSendMidiMessage(control);

        // The debounce is this adaptizer's own, not a property parked on the control. Shared
        // state there meant two adaptizers cancelled each other's sends instead of both
        // sending, which is what hid the duplicate adaptizer the configurator used to build.
        control.registerControlChangedListener(() => {
            clearTimeout(this._pendingSends.get(control));
            this._pendingSends.set(control, setTimeout(() => {
                this._pendingSends.delete(control);
                this._calculateAndSendMidiMessage(control);
            }, 300));
        });
    }

    setInput(input: number) {
        this._input = input;
        this._project.getControls().forEach((control: Control) => {
            this._calculateAndSendMidiMessage(control);
        });
    }

    sendControl(control: Control) {
        this._calculateAndSendMidiMessage(control);
    }

    private _calculateAndSendMidiMessage(control: Control) {
        const midiValue = control.calculateControlValue(this._input);
        this._midiPort.sendMidiMessage(control.controlNumber, midiValue);
    }
}

export default Adaptizer;

