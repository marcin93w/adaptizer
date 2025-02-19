import React from "react";
import Project from "../../domain/project";
import { TransformType } from "../../../shared/dtos";
import { InputType } from "../../../shared/dtos";
import { Control } from "../../domain/control";
import "./configurator.scss";
import AdaptizerKnob from "../adaptizer-knob/adaptizer-knob";
import { LinearControl } from "../linear-control/linear-control";
import Adaptizer from "../../domain/adaptizer";

export default function Configurator({ project }: { project: Project }) {
    const [selectedInput, setSelectedInput] = React.useState(project.getInputType());
    const [controls, setControls] = React.useState(project.getControls());
    const [selectedControl, setSelectedControl] = React.useState<Control | null>(project.getControls()[0]);
    const [inputValue, setInputValue] = React.useState(0);
    const [adaptizer, setAdaptizer] = React.useState<Adaptizer>(new Adaptizer(project, inputValue));
    
    React.useEffect(() => {
        setAdaptizer(new Adaptizer(project, inputValue));
        adaptizer.initialize();
    }, [project]);

    React.useEffect(() => {
        adaptizer.setInput(inputValue);
    }, [inputValue]);

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
