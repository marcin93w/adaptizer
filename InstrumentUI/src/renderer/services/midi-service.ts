class MidiService {
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
      this.midiOutput.send([0xB0, controlNumber, midiValue]);
      return;
    }
  }
}

export default MidiService.getInstance();
