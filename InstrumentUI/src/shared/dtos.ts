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

// One track is rendered per input value (0..9)
export const exportTrackCount = 10;

export interface ExportSettingsDto {
  outputPath: string;
  bpm: number;
  packagerPath: string;
}

export interface ExportTrackDto {
  outputPath: string;
  trackIndex: number;
}

export interface ExportResultDto {
  error: string | null;
}
