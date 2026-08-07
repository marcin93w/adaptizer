import { app, BrowserWindow } from "electron";
import { createMenu } from "./menu";
import { join } from "path";
import { ProjecManager } from "./project-manager";
import { ExportManager } from "./export-manager";

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
  });

  createMenu(projectManager, exportManager);
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

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
