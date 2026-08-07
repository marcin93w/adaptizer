import React from "react";
import Adaptizer from "../../domain/adaptizer";
import Exporter, { ExportProgress, ExportStage } from "../../domain/exporter";
import "./export-dialog.scss";

interface ExportDialogProps {
    adaptizer: Adaptizer;
    onClose: () => void;
}

const settingsStorageKey = "adaptizer.exportSettings";

const readStoredSettings = () => {
    try {
        return JSON.parse(localStorage.getItem(settingsStorageKey) ?? "{}");
    } catch {
        return {};
    }
};

export const ExportDialog: React.FC<ExportDialogProps> = ({ adaptizer, onClose }) => {
    const storedSettings = readStoredSettings();
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

    // The field is empty while the tempo is being retyped, so it is kept as text and parsed on export
    const parsedBpm = parseInt(bpm, 10);
    const isBpmValid = parsedBpm >= 1;

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
        if (error) {
            return <div className="export-message error">{error}</div>;
        }
        if (isCompleted) {
            return <div className="export-message success">
                Export complete. Host <b>manifest.mpd</b> in the same directory with all .webm files.
            </div>;
        }
        if (isCancelling) {
            return <div className="export-message">Cancelling after the track that is being rendered...</div>;
        }
        if (isCancelled) {
            return <div className="export-message">Export cancelled.</div>;
        }
        if (progress?.stage === ExportStage.CONVERTING) {
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
                <input type="number" min={1} value={bpm} disabled={isExporting}
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
                    ? <button onClick={cancelExport} disabled={isCancelling}>Cancel</button>
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
