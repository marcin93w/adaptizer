import { MidiPort } from "./midi-port";

class MidiService implements MidiPort {
  private static instance: MidiService | null = null;
  private midiOutput: MIDIOutput | undefined;
  private outputMissing: boolean = false;

  private constructor() {
  }

  public static getInstance(): MidiService {
    if (!MidiService.instance) {
      MidiService.instance = new MidiService();
    }
    return MidiService.instance;
  }

  async requestMIDIAccess() {
    const midiAccess = await navigator.requestMIDIAccess();
    this.midiOutput = [...midiAccess.outputs.values()].find(output => output.name === "Adaptizer");
    this.outputMissing = this.midiOutput === undefined;
  }

  isOutputMissing() {
    return this.outputMissing;
  }

  sendMidiMessage(controlNumber: number, midiValue: number) {
    if (this.midiOutput) {
      console.log(`Sending MIDI signal: controlNumber=${controlNumber}, value=${midiValue}`);
      this.midiOutput.send([0xB1, controlNumber, midiValue]);
      return;
    }
  }
}

export default MidiService.getInstance();
