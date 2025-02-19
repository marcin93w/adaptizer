import { Menu } from "electron";
import { ProjecManager } from "./project-manager";

export const createMenu = (pojectManager: ProjecManager) => {
  const template = [
    {
        label: 'File',
        submenu: [
        {
            label: 'New Project',
            click: () => {
                pojectManager.newProject();
            }
        }, {
            label: 'Open Project',
            click: () => {
                pojectManager.openProject();
            }   
        }, {
            label: 'Save Project',
            click: async () => {
                await pojectManager.saveProject();
            }
        }]
    }];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};
