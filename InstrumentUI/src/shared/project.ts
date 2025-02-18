import { Control } from "./control";

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
    public controls: Map<number, Control>,
  ) {}
}

class Project {
  constructor(public name: string) {}

  private _config: InputConfig = new InputConfig(InputType.INTENSITY, new Map([[1, new Control(1, TransformType.LINEAR, 0, 9, 0, 127)]]));

  setInputType(inputType: InputType) {
    this._config.type = inputType;
  }

  addControl(control: Control) {
    this._config.controls.set(control.controlNumber, control);
  }

  getInputType() {
    return this._config.type;
  }

  getControls(): Control[] {
    return Array.from(this._config.controls.values());
  }

  toJson() {
    return this._config;
  }
}

export default Project;
