import { contextBridge, ipcRenderer } from "electron";
import {
  cancelConversionRequest,
  checkExportToolsRequest,
  convertToDashRequest,
  exportRequestedEvent,
  exportTrackRequest,
  projectOpenedEvent,
  projectUpdatedEvent,
  selectExportFolderRequest,
  selectPackagerRequest
} from "../shared/actions";
import { ExportSettingsDto, ProjectDto } from "../shared/dtos";
import { ElectronApi } from "../shared/electron-api";

declare global {
  interface Window {
      electronAPI: ElectronApi;
  }
}

contextBridge.exposeInMainWorld("electronAPI", {
  onProjectOpened: (callback) => {
    ipcRenderer.on(projectOpenedEvent, (_, data) => callback(data));
  },
  sendProjectUpdated: (project: ProjectDto) => {
    ipcRenderer.send(projectUpdatedEvent, project);
  },
  // Returns the unsubscribe, so a renderer that remounts does not end up with two listeners
  onExportRequested: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(exportRequestedEvent, listener);
    return () => ipcRenderer.removeListener(exportRequestedEvent, listener);
  },
  selectExportFolder: () => ipcRenderer.invoke(selectExportFolderRequest),
  selectPackager: () => ipcRenderer.invoke(selectPackagerRequest),
  exportTrack: (outputPath: string, trackIndex: number) =>
    ipcRenderer.invoke(exportTrackRequest, { outputPath, trackIndex }),
  checkExportTools: (settings: ExportSettingsDto) => ipcRenderer.invoke(checkExportToolsRequest, settings),
  convertToDash: (settings: ExportSettingsDto) => ipcRenderer.invoke(convertToDashRequest, settings),
  cancelConversion: () => ipcRenderer.invoke(cancelConversionRequest)
});
