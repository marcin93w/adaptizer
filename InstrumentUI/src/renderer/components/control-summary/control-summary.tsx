import React, { useEffect, useState } from "react";
import "./control-summary.scss";
import { Control } from "../../domain/control";
import { CurvePreview } from "../automation-curve/automation-curve";

interface ControlSummaryProps {
    control: Control;
    isSelected: boolean;
    onSelect: (control: Control) => void;
    inputValue: number;
}

export const ControlSummary: React.FC<ControlSummaryProps> = ({ control, isSelected, onSelect, inputValue }) => {
    const [, forceRender] = useState(0);

    useEffect(() => {
        const listener = () => forceRender(version => version + 1);
        control.registerControlChangedListener(listener);
        return () => control.unregisterControlChangedListener(listener);
    }, [control]);

    return <div onClick={() => onSelect(control)} className={`control-row ${isSelected ? "selected" : ""}`}>
        <span className="cell-name">CC {control.controlNumber}</span>
        <span className="cell-curve"><CurvePreview control={control} inputValue={inputValue} /></span>
        <span className="cell-value">{control.calculateControlValue(inputValue)}</span>
    </div>;
};
