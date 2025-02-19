import { contextBridge, ipcRenderer } from "electron";
import { projectOpenedEvent, projectUpdatedEvent } from "../shared/actions";
import { ProjectDto } from "../shared/dtos";

declare global {
  interface Window {
      electronAPI: {
          onProjectOpened: (callback: (project: ProjectDto) => void) => void;
          sendProjectUpdated: (project: ProjectDto) => void;
      }
  }
}

contextBridge.exposeInMainWorld("electronAPI", {
  onProjectOpened: (callback) => {
    ipcRenderer.on(projectOpenedEvent, (_, data) => callback(data));
  },
  sendProjectUpdated: (project: ProjectDto) => {
    ipcRenderer.send(projectUpdatedEvent, project);
  }
});
