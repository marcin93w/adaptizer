import React from "react";
import Project, { TransformType, InputType } from "../../shared/project";
import { Control } from "../../shared/control";
import "./configurator.scss";
import AdaptizerKnob from "../adaptizer-knob/adaptizer-knob";
import { LinearControl } from "../linear-control/linear-control";

export default function Configurator({ project }: { project: Project }) {
    const [selectedInput, setSelectedInput] = React.useState(project.getInputType());
    const [controls, setControls] = React.useState(project.getControls());
    const [selectedControl, setSelectedControl] = React.useState<Control | null>(project.getControls()[0]);
    const [inputValue, setInputValue] = React.useState(0);
  
    React.useEffect(() => {
        setControls(project.getControls());
        setSelectedInput(project.getInputType());
    }, [project]);

    const handleInputChange = (input: InputType) => {
        setSelectedInput(input);
        project.setInputType(input);
    };

    const addNewControl = () => {
        const newControl = new Control(project.getControls().length + 1, TransformType.LINEAR, 0, 9, 0, 127);
        project.addControl(newControl);
        setControls(project.getControls());
        setSelectedControl(newControl);
    }

    return <div id="configurator">
        <div id="inputs">
            <div className={`input-item ${selectedInput === InputType.VOLUME ?  "selected" : ""}`} onClick={() => handleInputChange(InputType.VOLUME)} >Volume</div>
            <div className={`input-item ${selectedInput === InputType.INTENSITY ? "selected" : ""}`} onClick={() => handleInputChange(InputType.INTENSITY)}>Intensity</div>
            <div className={`input-item ${selectedInput === InputType.EXPRESSION ? "selected" : ""}`} onClick={() => handleInputChange(InputType.EXPRESSION)}>Expression</div>
        </div>
        <AdaptizerKnob min={0} max={9} step={1} onChange={setInputValue} />
        <div id="controls">
            {controls.map(control => (
                <LinearControl key={control.controlNumber} 
                    control={control} 
                    isSelected={selectedControl === control} 
                    setSelectedControl={setSelectedControl} 
                    inputValue={inputValue} />
            ))}
            <div className="add-control-button" onClick={() => addNewControl()}>+</div>
        </div>
    </div>;
}
