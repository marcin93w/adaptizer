import React, { useEffect, useState } from "react";
import './control-detail.scss';
import { Control } from "../../domain/control";
import { AutomationCurve } from "../automation-curve/automation-curve";

interface ControlDetailProps {
    control: Control;
    onInvoke: (control: Control) => void;
    inputValue: number;
    inputLabel: string;
}

export const ControlDetail: React.FC<ControlDetailProps> = ({ control, onInvoke, inputValue, inputLabel }) => {
    // The control is the single source of truth - copying its values into state would make them
    // go stale whenever React reuses this component for a different control (e.g. after an import).
    const [, forceRender] = useState(0);

    useEffect(() => {
        const listener = () => forceRender(version => version + 1);
        control.registerControlChangedListener(listener);
        return () => control.unregisterControlChangedListener(listener);
    }, [control]);

    const midiValue = control.calculateControlValue(inputValue);

    return <div className="control-detail">
        <div className="control-detail-identity">
            <span className="control-label">CC {control.controlNumber}</span>
        </div>

        <AutomationCurve control={control} inputValue={inputValue} inputLabel={inputLabel} />

        <div className="control-detail-output">
            <div className="output-readout">
                <span className="control-output-label">MIDI out</span>
                <span className="control-value">{midiValue}</span>
            </div>
            <button className="invoke-button" onClick={() => onInvoke(control)}>Invoke</button>
        </div>
    </div>;
};
