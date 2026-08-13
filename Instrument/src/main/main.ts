import { app, BrowserWindow } from "electron";
import { createMenu } from "./menu";
import { join } from "path";
import { ProjecManager } from "./project-manager";
import { ExportManager } from "./export-manager";
import { stopRunningScripts } from "./ableton-exporter";

let mainWindow: BrowserWindow | null = null;
let projectManager: ProjecManager | null = null;
let exportManager: ExportManager | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      preload: join(__dirname, "preload.js"),
    },
  });

  projectManager = new ProjecManager(mainWindow);
  exportManager = new ExportManager(mainWindow);

  // Relative paths resolve against the app root, which is not the main script directory once packaged
  mainWindow.loadFile(join(__dirname, "../renderer/index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
    // Nothing is left to report the progress or the result of an export
    stopRunningScripts();
  });

  createMenu(projectManager, exportManager);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

// An export outlives the app otherwise, and the script that would have finished and cleaned up after it is gone
app.on("before-quit", stopRunningScripts);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
