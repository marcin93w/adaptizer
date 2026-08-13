export interface ProjectDto {
  formatVersion: typeof projectFormatVersion;
  dimension: Dimension;
  controls: ControlDto[];
}

export const projectFormatVersion = 1 as const;

export interface ControlPointDto {
  input: number;
  midi: number;
}

export interface ControlDto {
  controlNumber: number;
  points: ControlPointDto[];
}

// The adaptation axis a song is mapped to - what an input level of 0..9 means. These four
// strings are the contract: the same spelling is typed into the catalog, returned by the
// Worker and resolved in the player, never re-cased and never mapped. See ADR-0001.
export enum Dimension {
  VOLUME = "volume",
  HEART_RATE = "heartRate",
  MOVEMENT_SPEED = "movementSpeed",
  INTENSITY = "intensity"
}

// One track is rendered per input level (0..9)
export const exportTrackCount = 10;
export const inputValueMin = 0;
export const inputValueMax = exportTrackCount - 1;
export const midiValueMin = 0;
export const midiValueMax = 127;
export const midiControlNumberMin = 0;
export const midiControlNumberMax = 127;

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
