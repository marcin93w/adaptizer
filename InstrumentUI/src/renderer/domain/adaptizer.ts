import Project from "./project";
import { Control } from "./control";
import { MidiPort } from "../services/midi-port";

class Adaptizer {
    private _input: number;

    constructor(private _project: Project, private initialInput: number, private readonly _midiPort: MidiPort) {
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
        
        control.registerControlChangedListener(() => {
            clearTimeout(control['_debounceTimeout']);
            control['_debounceTimeout'] = setTimeout(() => {
                this._calculateAndSendMidiMessage(control);
            }, 300);
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

