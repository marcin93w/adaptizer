import React from "react";
import Adaptizer from "../../domain/adaptizer";
import Exporter, { ExportProgress, ExportStage } from "../../domain/exporter";
import { ExportSettingsDto } from "../../../shared/dtos";
import "./export-dialog.scss";

interface ExportDialogProps {
    adaptizer: Adaptizer;
    onClose: () => void;
}

const settingsStorageKey = "adaptizer.exportSettings";

const readStoredSettings = (): Partial<ExportSettingsDto> => {
    try {
        const stored = JSON.parse(localStorage.getItem(settingsStorageKey) ?? "{}");
        // Anything else parses fine but has no fields to read, and null would throw on the first access
        return stored !== null && typeof stored === "object" ? stored : {};
    } catch {
        return {};
    }
};

export const ExportDialog: React.FC<ExportDialogProps> = ({ adaptizer, onClose }) => {
    // The stored settings only seed the fields, so they are read once instead of on every render
    const [storedSettings] = React.useState(readStoredSettings);
    const [outputPath, setOutputPath] = React.useState<string>(storedSettings.outputPath ?? "");
    const [bpm, setBpm] = React.useState<string>(String(storedSettings.bpm ?? 120));
    const [packagerPath, setPackagerPath] = React.useState<string>(storedSettings.packagerPath ?? "");
    const [exporter, setExporter] = React.useState<Exporter | null>(null);
    const [isExporting, setIsExporting] = React.useState(false);
    const [isCancelling, setIsCancelling] = React.useState(false);
    const [isCancelled, setIsCancelled] = React.useState(false);
    const [progress, setProgress] = React.useState<ExportProgress | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const isCompleted = progress?.stage === ExportStage.COMPLETED;
    // The conversion is a single external step that runs to the end once it started
    const isConverting = progress?.stage === ExportStage.CONVERTING;

    // The field is empty while the tempo is being retyped, so it is kept as text and parsed on export
    const parsedBpm = parseFloat(bpm);
    const isBpmValid = Number.isFinite(parsedBpm) && parsedBpm > 0;

    const selectOutputPath = async () => {
        const selectedPath = await window.electronAPI.selectExportFolder();
        if (selectedPath) {
            setOutputPath(selectedPath);
        }
    };

    const selectPackagerPath = async () => {
        const selectedPath = await window.electronAPI.selectPackager();
        if (selectedPath) {
            setPackagerPath(selectedPath);
        }
    };

    const startExport = async () => {
        const settings = { outputPath, bpm: parsedBpm, packagerPath };
        localStorage.setItem(settingsStorageKey, JSON.stringify(settings));

        const newExporter = new Exporter(adaptizer);
        setExporter(newExporter);
        setIsExporting(true);
        setError(null);
        setProgress(null);
        setIsCancelled(false);

        try {
            await newExporter.export(settings, setProgress);
        } catch (exportError: any) {
            setError(exportError?.message ?? "Unknown error");
        } finally {
            setExporter(null);
            setIsExporting(false);
            setIsCancelling(false);
            setIsCancelled(newExporter.isCancelled);
        }
    };

    const cancelExport = () => {
        exporter?.cancel();
        setIsCancelling(true);
    };

    const close = () => {
        exporter?.cancel();
        onClose();
    };

    const renderProgress = () => {
        // The track that was still rendering can fail on its way out, which is not what the user needs to hear
        if (isCancelling) {
            return <div className="export-message">Cancelling after the track that is being rendered...</div>;
        }
        if (isCancelled) {
            return <div className="export-message">Export cancelled.</div>;
        }
        if (error) {
            return <div className="export-message error">{error}</div>;
        }
        if (isCompleted) {
            return <div className="export-message success">
                Export complete. Host <b>manifest.mpd</b> in the same directory with all .webm files.
            </div>;
        }
        if (isConverting) {
            return <div className="export-message">Converting WAV files to DASH format...</div>;
        }
        if (progress?.stage === ExportStage.RENDERING) {
            return <div className="export-message">
                Exporting track {progress.trackIndex + 1} of {progress.totalTracks}. Please do not use Ableton Live while exporting.
            </div>;
        }
        return null;
    };

    return <div className="export-overlay">
        <div className="export-dialog">
            <div className="export-title">Export Ableton project</div>
            <div className="export-setting">
                <label>Output folder: </label>
                <span className="export-path">{outputPath || "No folder selected"}</span>
                <button onClick={selectOutputPath} disabled={isExporting}>Browse</button>
            </div>
            <div className="export-setting">
                <label>BPM: </label>
                <input type="number" min={0} step="any" value={bpm} disabled={isExporting}
                    onChange={(e) => setBpm(e.target.value)} />
            </div>
            <div className="export-setting">
                <label>Shaka packager: </label>
                <span className="export-path">{packagerPath || "Use packager-win-x64.exe from PATH"}</span>
                <button onClick={selectPackagerPath} disabled={isExporting}>Browse</button>
            </div>
            {renderProgress()}
            <div className="export-buttons">
                {isExporting
                    ? <button onClick={cancelExport} disabled={isCancelling || isConverting}>Cancel</button>
                    : <>
                        <button onClick={close}>Close</button>
                        <button className="primary" onClick={startExport} disabled={!outputPath || !isBpmValid}>
                            {isCompleted || error ? "Export again" : "Export"}
                        </button>
                    </>}
            </div>
        </div>
    </div>;
};
