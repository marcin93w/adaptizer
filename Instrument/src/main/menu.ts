import { Menu, MenuItemConstructorOptions } from "electron";
import { ProjecManager } from "./project-manager";
import { ExportManager } from "./export-manager";

export const createMenu = (pojectManager: ProjecManager, exportManager: ExportManager) => {
  const template: MenuItemConstructorOptions[] = [
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
        }, {
            type: 'separator'
        }, {
            label: 'Export Ableton Project',
            click: () => {
                exportManager.requestExport();
            }
        }]
    }];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};
