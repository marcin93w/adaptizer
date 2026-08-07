import Adaptizer from "./adaptizer";
import { exportTrackCount, ExportSettingsDto } from "../../shared/dtos";

export enum ExportStage {
    RENDERING = "rendering",
    CONVERTING = "converting",
    COMPLETED = "completed"
}

export interface ExportProgress {
    stage: ExportStage;
    trackIndex: number;
    totalTracks: number;
}

// Time given to the DAW to react to the control values before rendering the track
const controlValuesSettleTime = 500;

class Exporter {
    private _cancelled = false;

    constructor(private _adaptizer: Adaptizer) { }

    get isCancelled(): boolean {
        return this._cancelled;
    }

    cancel() {
        this._cancelled = true;
    }

    async export(settings: ExportSettingsDto, onProgress: (progress: ExportProgress) => void): Promise<void> {
        // Rendering every track takes long enough that a missing converter has to be reported before it starts
        const toolsResult = await window.electronAPI.checkExportTools(settings);
        if (toolsResult.error) {
            throw new Error(toolsResult.error);
        }

        for (let trackIndex = 0; trackIndex < exportTrackCount; trackIndex++) {
            if (this._cancelled) {
                return;
            }

            onProgress({ stage: ExportStage.RENDERING, trackIndex, totalTracks: exportTrackCount });

            this._adaptizer.setInput(trackIndex);
            await new Promise(resolve => setTimeout(resolve, controlValuesSettleTime));

            const result = await window.electronAPI.exportTrack(settings.outputPath, trackIndex);
            if (result.error) {
                throw new Error(result.error);
            }
        }

        if (this._cancelled) {
            return;
        }

        onProgress({ stage: ExportStage.CONVERTING, trackIndex: exportTrackCount, totalTracks: exportTrackCount });

        const conversionResult = await window.electronAPI.convertToDash(settings);
        if (conversionResult.error) {
            throw new Error(conversionResult.error);
        }

        onProgress({ stage: ExportStage.COMPLETED, trackIndex: exportTrackCount, totalTracks: exportTrackCount });
    }
}

export default Exporter;
