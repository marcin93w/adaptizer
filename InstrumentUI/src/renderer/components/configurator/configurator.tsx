import React from "react";
import Project from "../../domain/project";
import { InputType, inputValueMax, inputValueMin } from "../../../shared/dtos";
import { Control } from "../../domain/control";
import "./configurator.scss";
import AdaptizerKnob from "../adaptizer-knob/adaptizer-knob";
import { ControlSummary } from "../control-summary/control-summary";
import { ControlDetail } from "../control-detail/control-detail";
import Adaptizer from "../../domain/adaptizer";
import MidiService from "../../services/midi-service";
import { ExportDialog } from "../export-dialog/export-dialog";

// The input the app starts on, held in one place because the knob, the control list and the
// adaptizer all have to agree about it on the very first render. It is the bottom of the
// range on purpose: it is what the export's first track renders, so what the DAW hears
// before the user touches anything is a value the finished song actually contains.
const startingInputValue = inputValueMin;

export default function Configurator({ project }: { project: Project }) {
    const [selectedInput, setSelectedInput] = React.useState(project.getInputType());
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
        () => new Adaptizer(project, inputValueRef.current, MidiService), [project]);

    React.useEffect(() => window.electronAPI.onExportRequested(() => setIsExportDialogOpen(true)), []);

    React.useEffect(() => {
        adaptizer.initialize();
    }, [adaptizer]);

    React.useEffect(() => {
        adaptizer.setInput(inputValue);
    }, [inputValue, adaptizer]);

    React.useEffect(() => {
        setControls(project.getControls());
        setSelectedControl(project.getControls()[0] ?? null);
        setSelectedInput(project.getInputType());
        // The export renders the project it was started for, so opening another one ends it
        setIsExportDialogOpen(false);
    }, [project]);

    const handleInputChange = (input: InputType) => {
        setSelectedInput(input);
        project.setInputType(input);
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

    const inputLabel = selectedInput.charAt(0).toUpperCase() + selectedInput.slice(1);

    return <div id="configurator">
        <div id="workspace">
            <section className="source-panel">
                <div className="panel-heading">Input</div>
                <div id="inputs">
                    <div className={`input-item ${selectedInput === InputType.VOLUME ?  "selected" : ""}`} onClick={() => handleInputChange(InputType.VOLUME)} >Volume</div>
                    <div className={`input-item ${selectedInput === InputType.INTENSITY ? "selected" : ""}`} onClick={() => handleInputChange(InputType.INTENSITY)}>Intensity</div>
                    <div className={`input-item ${selectedInput === InputType.EXPRESSION ? "selected" : ""}`} onClick={() => handleInputChange(InputType.EXPRESSION)}>Expression</div>
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
                ? <ControlDetail control={selectedControl} onInvoke={handleInvokeControl} inputValue={inputValue} inputLabel={inputLabel} />
                : <div className="detail-placeholder">Select a control above to edit it</div>}
        </section>
        {isExportDialogOpen && <ExportDialog adaptizer={adaptizer} onClose={() => {
            setIsExportDialogOpen(false);
            adaptizer.setInput(inputValue);
        }} />}
    </div>;
}
