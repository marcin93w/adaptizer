import Project, { ProjectDto } from "../shared/project";
import { projectOpenedEvent, projectUpdatedEvent } from "../shared/actions";
import { BrowserWindow, dialog, ipcMain } from "electron";
import { writeFile } from "fs";

export class ProjecManager {    
    mainWindow: BrowserWindow;
    project: ProjectDto | null;
    projectName: string | null;

    constructor(mainWindow: BrowserWindow) {
        this.project = null;
        this.projectName = null;
        this.mainWindow = mainWindow;
        ipcMain.on(projectUpdatedEvent, (event, project: ProjectDto) => {
            this.project = project;
        });
    }

    newProject() {
        this.project = new Project().toDto();
        this.projectName = "New Project";
        this.mainWindow.webContents.send(projectOpenedEvent, this.project);
        this.mainWindow.setTitle(this.projectName + " - Adaptizer");
    }

    openProject() {
        return dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Adaptizer Project', extensions: ['adz'] }]
        }).then((result: any) => {
            if (result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                const projectName = filePath.split('\\').pop()?.split('.').shift();

                const fs = require('fs');
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const projectData = JSON.parse(fileContent);

                this.project = projectData;
                this.projectName = projectName;
                this.mainWindow.webContents.send(projectOpenedEvent, projectData);
                this.mainWindow.setTitle(this.projectName + " - Adaptizer");
            }
            return Promise.resolve();
        });
    }
    
    async saveProject(): Promise<void> {
        return dialog.showSaveDialog({
            filters: [{ name: 'Adaptizer Project', extensions: ['adz'] }]
        }).then(async (result: any) => {
            if (result.filePath) {
                const filePath = result.filePath;
                const projectData = JSON.stringify(this.project);
                await writeFile(filePath, projectData, (err: any) => {
                    if (err) {
                        console.error(err);
                    }
                });
            }
        });
    }
}
