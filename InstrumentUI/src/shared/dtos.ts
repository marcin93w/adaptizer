export interface ProjectDto {
  formatVersion: typeof projectFormatVersion;
  inputType: InputType;
  controls: ControlDto[];
}

export const projectFormatVersion = 2 as const;

export interface ControlPointDto {
  input: number;
  midi: number;
}

export interface ControlDto {
  controlNumber: number;
  points: ControlPointDto[];
}

export enum InputType {
  VOLUME = "volume",
  INTENSITY = "intensity",
  EXPRESSION = "expression"
}

// One track is rendered per input value (0..9)
export const exportTrackCount = 10;
export const inputValueMin = 0;
export const inputValueMax = exportTrackCount - 1;
export const midiValueMin = 0;
export const midiValueMax = 127;

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
