import Project from "../renderer/domain/project";
import { ProjectDto } from "../shared/dtos";
import { projectOpenedEvent, projectUpdatedEvent } from "../shared/actions";
import { BrowserWindow, dialog, ipcMain } from "electron";
import { writeFile } from "fs/promises";

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
        this.project = Project.newDefault().toDto();
        this.projectName = "New Project";
        this.mainWindow.webContents.send(projectOpenedEvent, this.project);
        this.mainWindow.setTitle(this.projectName + " - Adaptizer");
    }

    openProject() {
        return dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Adaptizer Project', extensions: ['adz'] }]
        }).then(async (result: any) => {
            if (result.filePaths.length === 0) {
                return;
            }

            const filePath = result.filePaths[0];
            const projectName = filePath.split('\\').pop()?.split('.').shift();
            try {
                const fs = require('fs');
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const parsedProject = JSON.parse(fileContent) as ProjectDto;
                // Rebuild before replacing the current project. This validates the format and
                // all curve invariants while also normalizing point order for deterministic saves.
                const projectData = Project.fromDto(parsedProject).toDto();

                this.project = projectData;
                this.projectName = projectName;
                this.mainWindow.webContents.send(projectOpenedEvent, projectData);
                this.mainWindow.setTitle(this.projectName + " - Adaptizer");
            } catch (error) {
                const message = error instanceof Error ? error.message : "The project file is invalid.";
                await dialog.showMessageBox(this.mainWindow, {
                    type: "error",
                    title: "Could not open project",
                    message: "Could not open this Adaptizer project.",
                    detail: message
                });
            }
        });
    }
    
    async saveProject(): Promise<void> {
        const result: any = await dialog.showSaveDialog({
            filters: [{ name: 'Adaptizer Project', extensions: ['adz'] }]
        });
        if (!result.filePath) {
            return;
        }

        try {
            await writeFile(result.filePath, JSON.stringify(this.project), 'utf-8');
        } catch (error) {
            // A save that fails quietly is worse than one that fails loudly: the user walks away
            // believing the work is on disk. Nothing here can recover it, so all we can do is say so.
            const message = error instanceof Error ? error.message : String(error);
            dialog.showErrorBox("Could not save project", `The project was not saved.\n\n${message}`);
        }
    }
}
