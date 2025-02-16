import { app, BrowserWindow } from "electron";
import { createMenu } from "./menu";
import { join } from "path";
import { AppState } from "./app-state";

let mainWindow: BrowserWindow | null = null;
let appState: AppState | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      preload: join(__dirname, "preload.js"),
    },
  });

  appState = new AppState(mainWindow);

  mainWindow.loadFile("dist/renderer/index.html");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  createMenu(appState);
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
