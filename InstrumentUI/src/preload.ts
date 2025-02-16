import { contextBridge, ipcRenderer } from "electron";
import { projectOpenedEvent } from "./app-state.interface";

contextBridge.exposeInMainWorld("electronAPI", {
  onProjectOpened: (callback) => {
    ipcRenderer.on(projectOpenedEvent, (_, data) => callback(data));
  }
});
