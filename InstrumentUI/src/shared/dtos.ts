export interface ProjectDto {
  inputType: InputType;
  controls: ControlDto[];
}

export interface ControlDto {
  controlNumber: number;
  transformType: TransformType;
  inputMin: number;
  inputMax: number;
  midiMin: number;
  midiMax: number;
}

export enum InputType {
  VOLUME = "volume",
  INTENSITY = "intensity",
  EXPRESSION = "expression"
}

export enum TransformType {
  LINEAR = "linear",
  REVERSED_LINEAR = "reversed-linear"
}
