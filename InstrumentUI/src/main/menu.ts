import { Menu } from "electron";
import { AppState } from "./app-state";
import { openProject, saveProject } from "./project-manager";
import Project from "../shared/project";

export const createMenu = (appState: AppState) => {
  const template = [
    {
        label: 'File',
        submenu: [
        {
            label: 'New Project',
            click: () => {
                appState.openProject(new Project().toDto());
            }
        }, {
            label: 'Open Project',
            click: () => {
                openProject().then((project) => {
                    if (project) {
                        appState.openProject(project);
                    }
                });
            }   
        }, {
            label: 'Save Project',
            click: async () => {
                if (appState.getProject()) {
                    await saveProject(appState.getProject()!);
                }
            }
        }]
    }];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};
