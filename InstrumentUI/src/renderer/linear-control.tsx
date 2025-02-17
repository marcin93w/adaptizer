import React from "react";
import { Range } from 'react-range';
import { useState } from 'react';
import './linear-control.css';

export const LinearControl: React.FC<{isSelected?: boolean}> = ({isSelected = false}) => {
    const [midiRangeValues, setMidiRangeValues] = useState([0, 127]);
    const [inputRangeValues, setInputRangeValues] = useState([0, 9]);

    if (isSelected) {
        return <div className="linear-control control selected">
            <div className="control-label">Channel 1</div>
            <div className="control-setting">
                <label>Transform type: </label>
                <select>
                    <option value="linear">Linear</option>
                    <option value="reversed-linear">Reversed linear</option>
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
                        console.log('Min:', newValues[0], 'Max:', newValues[1]);
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
            <div className="control-value">50</div>
        </div>; 
    } else {
        return <div className="linear-control control">
            <div className="control-label">Channel 1</div>
            <div className="control-setting">Type: Linear</div>
            <div className="control-setting">Input range: {inputRangeValues[0]} .. {inputRangeValues[1]}</div>
            <div className="control-setting">MIDI range: {midiRangeValues[0]} .. {midiRangeValues[1]}</div>
            <div className="control-value">50</div>
        </div>;
    }
};

