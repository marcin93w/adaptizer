import { app, BrowserWindow } from "electron";
import { createMenu } from "./menu";
import { join } from "path";
import { ProjecManager } from "./project-manager";
import { ExportManager } from "./export-manager";
import { PublishManager } from "./publish-manager";
import { readPublishApiKey } from "./config";
import { stopRunningScripts } from "./ableton-exporter";

let mainWindow: BrowserWindow | null = null;
let projectManager: ProjecManager | null = null;
let exportManager: ExportManager | null = null;
let publishManager: PublishManager | null = null;

// Read once at launch: the key is never compiled in, only read off disk here (see ADR-0002)
const publishApiKey = readPublishApiKey();

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
  publishManager = new PublishManager(mainWindow, projectManager, publishApiKey);

  // Relative paths resolve against the app root, which is not the main script directory once packaged
  mainWindow.loadFile(join(__dirname, "../renderer/index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
    // Nothing is left to report the progress or the result of an export
    stopRunningScripts();
  });

  createMenu(projectManager, exportManager, publishManager);

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
