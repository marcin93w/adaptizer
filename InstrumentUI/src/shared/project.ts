export enum InputType {
  VOLUME = "volume",
  INTENSITY = "intensity",
  EXPRESSION = "expression",
}

export enum TransformType {
  LINEAR = "linear",
  REVERSED_LINEAR = "reversed-linear",
}

export class InputConfig {
  constructor(
    public type: InputType,
    public controls: ControlConfig[],
  ) {}
}

export class ControlConfig {
  constructor(
    public controlNumber: number,
    public transformType: TransformType,
    public inputMin: number,
    public inputMax: number,
    public midiMin: number,
    public midiMax: number,
  ) {}
}

class Project {
  constructor(public name: string) {}

  private _config: InputConfig = new InputConfig(InputType.INTENSITY, [new ControlConfig(1, TransformType.LINEAR, 0, 9, 0, 127)]);

  setInputType(inputType: InputType) {
    this._config.type = inputType;
  }

  addControl(control: ControlConfig) {
    this._config.controls.push(control);
  }

  getInputType() {
    return this._config.type;
  }

  getControls() {
    return this._config.controls;
  }

  toJson() {
    return this._config;
  }
}

export default Project;
