import React, { useEffect } from "react";
import { Range } from 'react-range';
import { useState } from 'react';
import './linear-control.scss';
import { TransformType } from "../../shared/project";
import { Control } from "../../shared/control";

interface LinearControlProps {
    control: Control;
    isSelected: boolean;
    setSelectedControl: (control: Control | null) => void;
    inputValue: number;
}

const transformTypeOptions = [
    { value: TransformType.LINEAR, label: 'Linear' },
    { value: TransformType.REVERSED_LINEAR, label: 'Reversed linear' },
];

export const LinearControl: React.FC<LinearControlProps> = ({ control, isSelected, setSelectedControl, inputValue }) => {
    const [midiRangeValues, setMidiRangeValues] = useState([control.midiMin, control.midiMax]);
    const [inputRangeValues, setInputRangeValues] = useState([control.inputMin, control.inputMax]);
    const [transformType, setTransformType] = useState(control.transformType);
    const [midiValue, setMidiValue] = useState(control.calculateControlValue(inputValue));

    control.registerControlChangedListener(() => {
        setMidiValue(control.calculateControlValue(inputValue));
    });

    useEffect(() => {
        setMidiValue(control.calculateControlValue(inputValue));
    }, [inputValue]);

    if (isSelected) {
        return <div className="linear-control control selected">
            <div className="control-label" onClick={() => setSelectedControl(null)}>CC {control.controlNumber}</div>
            <div className="control-setting">
                <label>Transform type: </label>
                <select value={transformType} onChange={(e) => {
                    setTransformType(e.target.value as TransformType);
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
                        setInputRangeValues(newValues);
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
                        setMidiRangeValues(newValues);
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
            <div className="control-value" onClick={() => setSelectedControl(null)}>{midiValue}</div>
        </div>; 
    } else {
        return <div onClick={() => setSelectedControl(control)} className="linear-control control">
            <div className="control-label">CC {control.controlNumber}</div>
            <div className="control-setting">Type: {transformTypeOptions.find(option => option.value === transformType)?.label}</div>
            <div className="control-setting">Input range: {inputRangeValues[0]} .. {inputRangeValues[1]}</div>
            <div className="control-setting">MIDI range: {midiRangeValues[0]} .. {midiRangeValues[1]}</div>
            <div className="control-value">{midiValue}</div>
        </div>;
    }
};

