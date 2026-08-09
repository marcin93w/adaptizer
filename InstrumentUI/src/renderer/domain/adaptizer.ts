import Project from "./project";
import { Control } from "./control";
import { MidiPort } from "../services/midi-port";

class Adaptizer {
    private _input: number;
    private readonly _controlListeners = new Map<Control, () => void>();
    private readonly _pendingSends = new Map<Control, ReturnType<typeof setTimeout>>();
    private readonly _controlAddedListener: (control: Control) => void;

    constructor(private _project: Project, initialInput: number, private readonly _midiPort: MidiPort) {
        this._input = initialInput;
        this._project.getControls().forEach((control: Control) => {
            this.sendNowAndOnEveryControlChange(control);
        });
        this._controlAddedListener = (control: Control) => this.sendNowAndOnEveryControlChange(control);
        this._project.registerControlAddedListener(this._controlAddedListener);
    }

    // Stops this adaptizer sending anything further. A debounced send is a live timer holding
    // the control it was scheduled for, so without this, editing a curve and immediately opening
    // another project lets the previous project's value reach the DAW 300 ms later.
    dispose() {
        this._project.unregisterControlAddedListener(this._controlAddedListener);
        this._controlListeners.forEach((listener, control) => control.unregisterControlChangedListener(listener));
        this._controlListeners.clear();
        this._pendingSends.forEach(pending => clearTimeout(pending));
        this._pendingSends.clear();
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

        if (this._controlListeners.has(control)) {
            return;
        }

        // The debounce is this adaptizer's own, not a property parked on the control. Shared
        // state there means two adaptizers cancel each other's sends instead of both sending -
        // which hid the duplicate adaptizer the configurator used to build.
        const listener = () => {
            clearTimeout(this._pendingSends.get(control));
            this._pendingSends.set(control, setTimeout(() => {
                this._pendingSends.delete(control);
                this._calculateAndSendMidiMessage(control);
            }, 300));
        };
        control.registerControlChangedListener(listener);
        this._controlListeners.set(control, listener);
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

