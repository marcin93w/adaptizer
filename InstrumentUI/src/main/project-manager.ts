import { dialog } from "electron";
import Project, { ProjectDto } from "../shared/project";
import { writeFile } from 'fs';

export async function openProject(): Promise<ProjectDto | null> {
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
                return Promise.resolve(projectData);
            }
            return Promise.resolve(null);
        });
}

export async function saveProject(project: ProjectDto): Promise<void> {
    return dialog.showSaveDialog({
        filters: [{ name: 'Adaptizer Project', extensions: ['adz'] }]
    }).then(async (result: any) => {
        if (result.filePath) {
            const filePath = result.filePath;
            const projectData = JSON.stringify(project);
            await writeFile(filePath, projectData, (err: any) => {
                if (err) {
                    console.error(err);
                }
            });
        }
    });
}
