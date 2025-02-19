import { app, BrowserWindow } from "electron";
import { createMenu } from "./menu";
import { join } from "path";
import { ProjecManager } from "./project-manager";

let mainWindow: BrowserWindow | null = null;
let projectManager: ProjecManager | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      preload: join(__dirname, "preload.js"),
    },
  });

  projectManager = new ProjecManager(mainWindow);

  mainWindow.loadFile("../renderer/index.html");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  createMenu(projectManager);
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
