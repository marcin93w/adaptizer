import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import { readFile } from "fs/promises";
import { ProjecManager } from "./project-manager";
import { publishRequest, publishRequestedEvent } from "../shared/actions";
import { PublishRequestDto, PublishResultDto } from "../shared/dtos";
import { publishExport } from "./publisher";

// The main process owns the publish because it is the app's only network egress and the one place
// the publish key lives (ADR-0002). It opens the dialog with the .adz name to default, and runs the
// POST with the real fetch, the real file reader and the key read once at launch.
export class PublishManager {
    private readonly mainWindow: BrowserWindow;
    private readonly projectManager: ProjecManager;
    private readonly apiKey: string | null;

    constructor(mainWindow: BrowserWindow, projectManager: ProjecManager, apiKey: string | null) {
        this.mainWindow = mainWindow;
        this.projectManager = projectManager;
        this.apiKey = apiKey;

        this.registerHandler(publishRequest, (_, request: PublishRequestDto) => this.publish(request));
    }

    // The window is recreated when it is reopened, and ipcMain.handle throws on an already handled channel
    private registerHandler(channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => any) {
        ipcMain.removeHandler(channel);
        ipcMain.handle(channel, handler);
    }

    // The name the .adz was opened under seeds the dialog's Name field, so the producer does not
    // retype it. A new, unsaved project has "New Project"; the producer can still rename it.
    requestPublish() {
        this.mainWindow.webContents.send(publishRequestedEvent, this.projectManager.projectName ?? "");
    }

    private publish(request: PublishRequestDto): Promise<PublishResultDto> {
        return publishExport(request, { apiKey: this.apiKey, fetch, readFile });
    }
}
