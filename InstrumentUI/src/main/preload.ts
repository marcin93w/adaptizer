import { contextBridge, ipcRenderer } from "electron";
import { projectOpenedEvent } from "../shared/app-state.interface";

contextBridge.exposeInMainWorld("electronAPI", {
  onProjectOpened: (callback) => {
    ipcRenderer.on(projectOpenedEvent, (_, data) => callback(data));
  }
});
