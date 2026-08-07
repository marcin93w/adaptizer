import { contextBridge, ipcRenderer } from "electron";
import {
  convertToDashRequest,
  exportRequestedEvent,
  exportTrackRequest,
  projectOpenedEvent,
  projectUpdatedEvent,
  selectExportFolderRequest,
  selectPackagerRequest
} from "../shared/actions";
import { ExportResultDto, ExportSettingsDto, ProjectDto } from "../shared/dtos";

declare global {
  interface Window {
      electronAPI: {
          onProjectOpened: (callback: (project: ProjectDto) => void) => void;
          sendProjectUpdated: (project: ProjectDto) => void;
          onExportRequested: (callback: () => void) => void;
          selectExportFolder: () => Promise<string | null>;
          selectPackager: () => Promise<string | null>;
          exportTrack: (outputPath: string, trackIndex: number) => Promise<ExportResultDto>;
          convertToDash: (settings: ExportSettingsDto) => Promise<ExportResultDto>;
      }
  }
}

contextBridge.exposeInMainWorld("electronAPI", {
  onProjectOpened: (callback) => {
    ipcRenderer.on(projectOpenedEvent, (_, data) => callback(data));
  },
  sendProjectUpdated: (project: ProjectDto) => {
    ipcRenderer.send(projectUpdatedEvent, project);
  },
  onExportRequested: (callback: () => void) => {
    ipcRenderer.on(exportRequestedEvent, () => callback());
  },
  selectExportFolder: () => ipcRenderer.invoke(selectExportFolderRequest),
  selectPackager: () => ipcRenderer.invoke(selectPackagerRequest),
  exportTrack: (outputPath: string, trackIndex: number) =>
    ipcRenderer.invoke(exportTrackRequest, { outputPath, trackIndex }),
  convertToDash: (settings: ExportSettingsDto) => ipcRenderer.invoke(convertToDashRequest, settings)
});
