import { BrowserWindow, dialog, ipcMain, IpcMainInvokeEvent } from "electron";
import { join } from "path";
import { AbletonExporter, runScript } from "./ableton-exporter";
import {
    checkExportToolsRequest,
    convertToDashRequest,
    exportRequestedEvent,
    exportTrackRequest,
    selectExportFolderRequest,
    selectPackagerRequest
} from "../shared/actions";
import { exportTrackCount, ExportResultDto, ExportSettingsDto, ExportTrackDto } from "../shared/dtos";

export class ExportManager {
    mainWindow: BrowserWindow;
    abletonExporter: AbletonExporter;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
        this.abletonExporter = new AbletonExporter();

        this.registerHandler(selectExportFolderRequest, () => this.selectExportFolder());
        this.registerHandler(selectPackagerRequest, () => this.selectPackager());
        this.registerHandler(exportTrackRequest, (_, track: ExportTrackDto) => this.exportTrack(track));
        this.registerHandler(checkExportToolsRequest, (_, settings: ExportSettingsDto) => this.checkExportTools(settings));
        this.registerHandler(convertToDashRequest, (_, settings: ExportSettingsDto) => this.convertToDash(settings));
    }

    // The window is recreated when it is reopened, and ipcMain.handle throws on an already handled channel
    private registerHandler(channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => any) {
        ipcMain.removeHandler(channel);
        ipcMain.handle(channel, handler);
    }

    requestExport() {
        this.mainWindow.webContents.send(exportRequestedEvent);
    }

    private async selectExportFolder(): Promise<string | null> {
        const result = await dialog.showOpenDialog(this.mainWindow, {
            title: "Select export folder",
            properties: ['openDirectory', 'createDirectory']
        });
        return result.filePaths.length > 0 ? result.filePaths[0] : null;
    }

    private async selectPackager(): Promise<string | null> {
        const result = await dialog.showOpenDialog(this.mainWindow, {
            title: "Select Shaka packager executable",
            properties: ['openFile'],
            filters: [{ name: 'Shaka packager', extensions: ['exe'] }]
        });
        return result.filePaths.length > 0 ? result.filePaths[0] : null;
    }

    private async exportTrack(track: ExportTrackDto): Promise<ExportResultDto> {
        return this.run(() => this.abletonExporter.export(join(track.outputPath, `${track.trackIndex}.wav`)));
    }

    // Rendering the tracks takes far longer than the conversion, so the settings are checked up front
    private async checkExportTools(settings: ExportSettingsDto): Promise<ExportResultDto> {
        return this.run(() => runScript("dash-converter.ps1", [...this.dashConverterArgs(settings), "-CheckToolsOnly"]));
    }

    private async convertToDash(settings: ExportSettingsDto): Promise<ExportResultDto> {
        return this.run(() => runScript("dash-converter.ps1", this.dashConverterArgs(settings)));
    }

    private dashConverterArgs(settings: ExportSettingsDto): string[] {
        return [
            "-ExportPath", settings.outputPath,
            "-Bpm", settings.bpm.toString(),
            "-TrackCount", exportTrackCount.toString(),
            ...(settings.packagerPath ? ["-PackagerPath", settings.packagerPath] : [])
        ];
    }

    private async run(action: () => Promise<unknown>): Promise<ExportResultDto> {
        try {
            await action();
            return { error: null };
        } catch (error: any) {
            console.error(error);
            return { error: error?.message ?? "Unknown error" };
        }
    }
}
