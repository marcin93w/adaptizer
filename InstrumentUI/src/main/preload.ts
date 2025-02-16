import { contextBridge, ipcRenderer } from "electron";
import { projectOpenedEvent } from "../shared/app-state.interface";
import Project from "../shared/project";

declare global {
  interface Window {
      electronAPI: {
          onProjectOpened: (callback: (project: Project) => void) => void;
      }
  }
}

contextBridge.exposeInMainWorld("electronAPI", {
  onProjectOpened: (callback) => {
    ipcRenderer.on(projectOpenedEvent, (_, data) => callback(data));
  }
});
