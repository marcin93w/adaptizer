import React from "react";
import Project from "../../domain/project";
import { Dimension, inputValueMax, inputValueMin } from "../../../shared/dtos";
import { Control } from "../../domain/control";
import "./configurator.scss";
import AdaptizerKnob from "../adaptizer-knob/adaptizer-knob";
import { ControlSummary } from "../control-summary/control-summary";
import { ControlDetail } from "../control-detail/control-detail";
import Adaptizer from "../../domain/adaptizer";
import MidiService from "../../services/midi-service";
import { MidiPort } from "../../services/midi-port";
import { ElectronApi } from "../../../shared/electron-api";
import { ExportDialog } from "../export-dialog/export-dialog";

// The input level the app starts on, held in one place because the knob, the control list and
// the adaptizer all have to agree about it on the very first render. It is the bottom of the
// range on purpose: it is what the export's first track renders, so what the DAW hears
// before the user touches anything is a level the finished song actually contains.
const startingInputValue = inputValueMin;

// Presentation only. The contract string is what gets persisted; these labels are produced for
// the screen and no code path turns one back into a dimension. Typed as a total map so a
// dimension added to the contract cannot reach the picker without a label to show for it.
const dimensionLabels: Record<Dimension, string> = {
    [Dimension.VOLUME]: "Volume",
    [Dimension.HEART_RATE]: "Heart rate",
    [Dimension.MOVEMENT_SPEED]: "Movement speed",
    [Dimension.INTENSITY]: "Intensity"
};

// The picker offers the contract's dimensions and nothing else. Taken from the contract rather
// than listed here, so a name the player cannot deliver has nowhere to survive on screen.
const offeredDimensions = Object.values(Dimension);

interface ConfiguratorProps {
    project: Project;
    // The two boundaries the configurator sits on. Defaults are evaluated at render time, so
    // production callers pass neither and nothing reaches for a global before a component mounts.
    midiPort?: MidiPort;
    electronApi?: ElectronApi;
}

export default function Configurator(
    { project, midiPort = MidiService, electronApi = window.electronAPI }: ConfiguratorProps) {
    const [selectedDimension, setSelectedDimension] = React.useState(project.getDimension());
    const [controls, setControls] = React.useState(project.getControls());
    const [selectedControl, setSelectedControl] = React.useState<Control | null>(project.getControls()[0]);
    const [inputValue, setInputValue] = React.useState(startingInputValue);
    const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false);

    // The adaptizer starts sending as soon as it is built, so it has to be built with the input
    // the knob is actually on - otherwise opening a project mid-audition announces every control
    // at the wrong value first.
    const inputValueRef = React.useRef(inputValue);
    inputValueRef.current = inputValue;

    // One adaptizer per project. Creating it in an effect that then initialized the one from the
    // closure left two of them live on the same controls, and asked the stale one for MIDI access.
    const adaptizer = React.useMemo(
        () => new Adaptizer(project, inputValueRef.current, midiPort), [project, midiPort]);

    React.useEffect(() => electronApi.onExportRequested(() => setIsExportDialogOpen(true)), [electronApi]);

    React.useEffect(() => {
        adaptizer.initialize();
    }, [adaptizer]);

    React.useEffect(() => {
        adaptizer.setInput(inputValue);
    }, [inputValue, adaptizer]);

    React.useEffect(() => {
        setControls(project.getControls());
        setSelectedControl(project.getControls()[0] ?? null);
        setSelectedDimension(project.getDimension());
        // The export renders the project it was started for, so opening another one ends it
        setIsExportDialogOpen(false);
    }, [project]);

    const handleDimensionChange = (dimension: Dimension) => {
        setSelectedDimension(dimension);
        project.setDimension(dimension);
    };

    const handleInvokeControl = (control: Control) => {
        adaptizer.sendControl(control);
    };

    const addNewControl = () => {
        const newControl = Control.withDefaultCurve(project.nextControlNumber());
        project.addControl(newControl);
        setControls(project.getControls());
        setSelectedControl(newControl);
    }

    const dimensionLabel = dimensionLabels[selectedDimension];

    return <div id="configurator">
        <div id="workspace">
            <section className="source-panel">
                <div className="panel-heading">Dimension</div>
                <div id="dimensions" role="radiogroup" aria-label="Dimension">
                    {offeredDimensions.map(dimension => (
                        <div key={dimension}
                            className={`dimension-item ${selectedDimension === dimension ? "selected" : ""}`}
                            role="radio"
                            aria-checked={selectedDimension === dimension}
                            tabIndex={0}
                            onClick={() => handleDimensionChange(dimension)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleDimensionChange(dimension);
                                }
                            }}>{dimensionLabels[dimension]}</div>
                    ))}
                </div>
                <AdaptizerKnob min={inputValueMin} max={inputValueMax} step={1}
                    initialValue={startingInputValue} onChange={setInputValue} />
            </section>
            <div className="signal-link" aria-hidden="true" />
            <section className="controls-panel">
                <div className="panel-heading">Controls</div>
                <div className="control-table">
                    <div className="control-row control-row-header">
                        <span>Control</span>
                        <span>Mapping</span>
                        <span className="cell-value">Out</span>
                    </div>
                    {controls.map(control => (
                        <ControlSummary key={control.controlNumber}
                            control={control}
                            isSelected={selectedControl === control}
                            onSelect={setSelectedControl}
                            inputValue={inputValue} />
                    ))}
                    <div className="add-control-row" onClick={() => addNewControl()}>+ Add control</div>
                </div>
            </section>
        </div>
        <section id="detail-section">
            <div className="panel-heading">Selected control</div>
            {selectedControl
                ? <ControlDetail control={selectedControl} onInvoke={handleInvokeControl} inputValue={inputValue} dimensionLabel={dimensionLabel} />
                : <div className="detail-placeholder">Select a control above to edit it</div>}
        </section>
        {isExportDialogOpen && <ExportDialog adaptizer={adaptizer} electronApi={electronApi} onClose={() => {
            setIsExportDialogOpen(false);
            adaptizer.setInput(inputValue);
        }} />}
    </div>;
}
