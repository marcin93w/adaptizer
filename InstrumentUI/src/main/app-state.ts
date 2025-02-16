import Project from "../shared/project";
import { IAppState, projectOpenedEvent } from "../shared/app-state.interface";
import { BrowserWindow } from "electron";

export class AppState implements IAppState {    
    mainWindow: BrowserWindow;
    project: Project | null;

    constructor(mainWindow: BrowserWindow) {
        this.project = null;
        this.mainWindow = mainWindow;
    }

    openProject(project: Project) {
        this.project = project;
        this.mainWindow.webContents.send(projectOpenedEvent, project);
    }
    
    getProject() {
        return this.project;
    }
}
