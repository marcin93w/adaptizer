import { ExportResultDto, ExportSettingsDto, ProjectDto } from "./dtos";

// Everything the renderer can ask of the main process. Exposed for real on
// window.electronAPI by main/preload.ts, and in memory by src/testing/fake-electron-api.ts.
export interface ElectronApi {
    onProjectOpened: (callback: (project: ProjectDto) => void) => void;
    sendProjectUpdated: (project: ProjectDto) => void;
    onExportRequested: (callback: () => void) => () => void;
    selectExportFolder: () => Promise<string | null>;
    selectPackager: () => Promise<string | null>;
    exportTrack: (outputPath: string, trackIndex: number) => Promise<ExportResultDto>;
    checkExportTools: (settings: ExportSettingsDto) => Promise<ExportResultDto>;
    convertToDash: (settings: ExportSettingsDto) => Promise<ExportResultDto>;
    cancelConversion: () => Promise<void>;
}
