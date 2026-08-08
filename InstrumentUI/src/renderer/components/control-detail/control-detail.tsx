import React, { useEffect, useState } from "react";
import { Range } from 'react-range';
import './control-detail.scss';
import { TransformType } from "../../../shared/dtos";
import { Control } from "../../domain/control";
import { transformTypeOptions } from "../linear-control/linear-control";

interface ControlDetailProps {
    control: Control;
    onInvoke: (control: Control) => void;
    inputValue: number;
}

export const ControlDetail: React.FC<ControlDetailProps> = ({ control, onInvoke, inputValue }) => {
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

    return <div className="control-detail">
        <div className="control-detail-identity">
            <span className="control-label">CC {control.controlNumber}</span>
        </div>

        <div className="control-detail-settings">
            <div className="control-setting setting-transform">
                <label>Transform type: </label>
                <select value={transformType} onChange={(e) => {
                    control.transformType = e.target.value as TransformType;
                }}>
                    {transformTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>
            <div className="range-container control-setting">
                <label>Input range: </label>
                <span className="range-value">{inputRangeValues[0]}</span>
                <Range
                    values={inputRangeValues}
                    step={1}
                    min={0}
                    max={9}
                    onChange={(newValues) => {
                        control.inputMin = newValues[0];
                        control.inputMax = newValues[1];
                    }}
                    renderTrack={({ props, children }) => (
                        <div
                            {...props}
                            className="range-track"
                        >
                            <div
                                className="range-track-highlight"
                                style={{
                                    width: `${(inputRangeValues[1] - inputRangeValues[0]) * 100 / 9}%`,
                                    left: `${inputRangeValues[0] * 100 / 9}%`,
                                }}
                            />
                            {children}
                        </div>
                    )}
                    renderThumb={({ props }) => (
                        <div
                            {...props}
                            className="range-thumb"
                        />
                    )}
                />
                <span className="range-value">{inputRangeValues[1]}</span>
            </div>
            <div className="range-container control-setting">
                <label>MIDI range: </label>
                <span className="range-value">{midiRangeValues[0]}</span>
                <Range
                    values={midiRangeValues}
                    step={1}
                    min={0}
                    max={127}
                    onChange={(newValues) => {
                        control.midiMin = newValues[0];
                        control.midiMax = newValues[1];
                    }}
                    renderTrack={({ props, children }) => (
                        <div
                            {...props}
                            className="range-track"
                        >
                            <div
                                className="range-track-highlight"
                                style={{
                                    width: `${(midiRangeValues[1] - midiRangeValues[0]) * 100 / 127}%`,
                                    left: `${midiRangeValues[0] * 100 / 127}%`,
                                }}
                            />
                            {children}
                        </div>
                    )}
                    renderThumb={({ props }) => (
                        <div
                            {...props}
                            className="range-thumb"
                        />
                    )}
                />
                <span className="range-value">{midiRangeValues[1]}</span>
            </div>
        </div>

        <div className="control-detail-output">
            <div className="output-readout">
                <span className="control-output-label">MIDI out</span>
                <span className="control-value">{midiValue}</span>
            </div>
            <button className="invoke-button" onClick={() => onInvoke(control)}>Invoke</button>
        </div>
    </div>;
};
