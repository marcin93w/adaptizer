import Project from "./project";
import { Control } from "./control";
import MidiService from "../services/midi-service";

class Adaptizer {
    private _input: number;

    constructor(private _project: Project, private initialInput: number) {
        this._input = initialInput;
        this._project.getControls().forEach((control: Control) => {
            this.sendNowAndOnEveryControlChange(control);
        });
        this._project.registerControlAddedListener((control: Control) => {
            this.sendNowAndOnEveryControlChange(control);
        });
    }

    async initialize() {
        await MidiService.requestMIDIAccess();
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

    private _calculateAndSendMidiMessage(control: Control) {
        const midiValue = control.calculateControlValue(this._input);
        MidiService.sendMidiMessage(control.controlNumber, midiValue);
    }
}

export default Adaptizer;

