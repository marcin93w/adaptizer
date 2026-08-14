import { ExportResultDto, ExportSettingsDto, ProjectDto, PublishRequestDto, PublishResultDto } from "./dtos";

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
    // The main process opens the Publish dialog, carrying the name the .adz was opened under so the
    // producer does not retype it. Returns the unsubscribe, like onExportRequested.
    onPublishRequested: (callback: (defaultName: string) => void) => () => void;
    // Publishing is the app's only network egress, so it lives in the main process: it reads the
    // export's files and the publish key and POSTs them to the Worker (see ADR-0002).
    publish: (request: PublishRequestDto) => Promise<PublishResultDto>;
}
