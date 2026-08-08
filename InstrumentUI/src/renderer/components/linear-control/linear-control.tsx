import React, { useEffect, useState } from "react";
import './linear-control.scss';
import { TransformType } from "../../../shared/dtos";
import { Control } from "../../domain/control";

interface LinearControlProps {
    control: Control;
    isSelected: boolean;
    onSelect: (control: Control) => void;
    inputValue: number;
}

export const transformTypeOptions = [
    { value: TransformType.LINEAR, label: 'Linear' },
    { value: TransformType.REVERSED_LINEAR, label: 'Reversed linear' },
];

export const LinearControl: React.FC<LinearControlProps> = ({ control, isSelected, onSelect, inputValue }) => {
    // The control is the single source of truth - copying its values into state would make them
    // go stale whenever React reuses this component for a different control (e.g. after an import).
    const [, forceRender] = useState(0);

    useEffect(() => {
        const listener = () => forceRender(version => version + 1);
        control.registerControlChangedListener(listener);
        return () => control.unregisterControlChangedListener(listener);
    }, [control]);

    const inputRangeValues = [control.inputMin, control.inputMax];
    const midiRangeValues = [control.midiMin, control.midiMax];
    const transformType = control.transformType;
    const midiValue = control.calculateControlValue(inputValue);

    return <div onClick={() => onSelect(control)} className={`control-row ${isSelected ? "selected" : ""}`}>
        <span className="cell-name">CC {control.controlNumber}</span>
        <span>{transformTypeOptions.find(option => option.value === transformType)?.label}</span>
        <span>{inputRangeValues[0]} .. {inputRangeValues[1]}</span>
        <span>{midiRangeValues[0]} .. {midiRangeValues[1]}</span>
        <span className="cell-value">{midiValue}</span>
    </div>;
};
