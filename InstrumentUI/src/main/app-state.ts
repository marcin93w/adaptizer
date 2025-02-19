import { ProjectDto } from "../shared/project";
import { projectOpenedEvent, projectUpdatedEvent } from "../shared/actions";
import { BrowserWindow, ipcMain } from "electron";

export class AppState {    
    mainWindow: BrowserWindow;
    project: ProjectDto | null;

    constructor(mainWindow: BrowserWindow) {
        this.project = null;
        this.mainWindow = mainWindow;
        ipcMain.on(projectUpdatedEvent, (event, project: ProjectDto) => {
            this.project = project;
        });
    }

    openProject(project: ProjectDto) {
        this.project = project;
        this.mainWindow.webContents.send(projectOpenedEvent, project);
    }
    
    getProject() {
        return this.project;
    }
}
