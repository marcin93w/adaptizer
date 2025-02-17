import React from "react";
import Project, { ControlConfig, TransformType } from "../../shared/project";
import { InputType } from "../../shared/project";
import "./configurator.scss";
import AdaptizerKnob from "../adaptizer-knob/adaptizer-knob";
import { LinearControl } from "../linear-control/linear-control";

export default function Configurator({ project }: { project: Project }) {

  const [selectedInput, setSelectedInput] = React.useState(project.getInputType());
  const [controls, setControls] = React.useState(project.getControls());
  const [selectedControl, setSelectedControl] = React.useState<ControlConfig | null>(project.getControls()[0]);

  const handleInputChange = (input: InputType) => {
    setSelectedInput(input);
    project.setInputType(input);
  };

  const addNewControl = () => {
      const newControl = new ControlConfig(project.getControls().length + 1, TransformType.LINEAR, 0, 9, 0, 127);
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
        <AdaptizerKnob min={0} max={9} step={1} />
        <div id="controls">
            {controls.map(control => (
                <LinearControl key={control.controlNumber} control={control} isSelected={selectedControl === control} setSelectedControl={setSelectedControl} />
            ))}
            <div className="add-control-button" onClick={() => addNewControl()}>+</div>
        </div>
    </div>;
}
