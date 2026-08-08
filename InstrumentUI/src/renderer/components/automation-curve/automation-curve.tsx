import React, { useEffect, useRef, useState } from "react";
import {
    inputValueMax,
    inputValueMin,
    midiValueMax,
    midiValueMin
} from "../../../shared/dtos";
import { Control } from "../../domain/control";
import "./automation-curve.scss";

const chartWidth = 720;
const chartHeight = 300;
const plot = { left: 54, right: 18, top: 16, bottom: 42 };
const plotWidth = chartWidth - plot.left - plot.right;
const plotHeight = chartHeight - plot.top - plot.bottom;
const midiTicks = [0, 32, 64, 96, 127];

const xForInput = (input: number) =>
    plot.left + ((input - inputValueMin) / (inputValueMax - inputValueMin)) * plotWidth;

const yForMidi = (midi: number) =>
    plot.top + (1 - ((midi - midiValueMin) / (midiValueMax - midiValueMin))) * plotHeight;

const polylinePoints = (control: Control) =>
    control.points.map(point => `${xForInput(point.input)},${yForMidi(point.midi)}`).join(" ");

interface CurvePreviewProps {
    control: Control;
    inputValue: number;
}

export const CurvePreview: React.FC<CurvePreviewProps> = ({ control, inputValue }) => {
    const points = control.points;
    const x = ((inputValue - inputValueMin) / (inputValueMax - inputValueMin)) * 180;
    const midi = control.calculateControlValue(inputValue);
    const y = (1 - midi / midiValueMax) * 44;
    const previewPoints = points.map(point =>
        `${((point.input - inputValueMin) / (inputValueMax - inputValueMin)) * 180},${(1 - point.midi / midiValueMax) * 44}`
    ).join(" ");

    return <svg className="curve-preview" viewBox="0 0 180 44" role="img" aria-label="Control curve preview">
        <line className="curve-preview-input" x1={x} x2={x} y1="0" y2="44" />
        <polyline className="curve-preview-line" points={previewPoints} />
        <circle className="curve-preview-output" cx={x} cy={y} r="3" />
    </svg>;
};

interface AutomationCurveProps {
    control: Control;
    inputValue: number;
    inputLabel: string;
}

export const AutomationCurve: React.FC<AutomationCurveProps> = ({ control, inputValue, inputLabel }) => {
    const [selectedInput, setSelectedInput] = useState(inputValueMin);
    const [, forceRender] = useState(0);
    const dragInput = useRef<number | null>(null);

    useEffect(() => {
        setSelectedInput(inputValueMin);
        const listener = () => forceRender(version => version + 1);
        control.registerControlChangedListener(listener);
        return () => control.unregisterControlChangedListener(listener);
    }, [control]);

    const points = control.points;
    const selectedPoint = points.find(point => point.input === selectedInput) ?? points[0];
    const selectedIndex = points.findIndex(point => point.input === selectedPoint.input);
    const isEndpoint = selectedPoint.input === inputValueMin || selectedPoint.input === inputValueMax;
    const minimumInput = isEndpoint ? selectedPoint.input : points[selectedIndex - 1].input + 1;
    const maximumInput = isEndpoint ? selectedPoint.input : points[selectedIndex + 1].input - 1;

    const eventValues = (event: React.PointerEvent<SVGElement>) => {
        const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget as SVGSVGElement;
        const bounds = svg.getBoundingClientRect();
        const chartX = (event.clientX - bounds.left) * chartWidth / bounds.width;
        const chartY = (event.clientY - bounds.top) * chartHeight / bounds.height;
        return {
            input: Math.max(inputValueMin, Math.min(inputValueMax,
                Math.round((chartX - plot.left) * (inputValueMax - inputValueMin) / plotWidth + inputValueMin))),
            midi: Math.max(midiValueMin, Math.min(midiValueMax,
                Math.round((1 - (chartY - plot.top) / plotHeight) * midiValueMax)))
        };
    };

    const updateSelectedPoint = (input: number, midi: number) => {
        const boundedInput = isEndpoint
            ? selectedPoint.input
            : Math.max(minimumInput, Math.min(maximumInput, input));
        control.movePoint(selectedPoint.input, boundedInput, midi);
        setSelectedInput(boundedInput);
    };

    const removeSelectedPoint = () => {
        if (isEndpoint) {
            return;
        }
        const nextSelection = points[selectedIndex - 1].input;
        control.removePoint(selectedPoint.input);
        setSelectedInput(nextSelection);
    };

    const handlePointKeyDown = (event: React.KeyboardEvent<SVGCircleElement>, pointInput: number) => {
        const point = control.points.find(candidate => candidate.input === pointInput);
        if (!point) {
            return;
        }
        const pointIndex = control.points.findIndex(candidate => candidate.input === pointInput);
        const endpoint = pointInput === inputValueMin || pointInput === inputValueMax;
        let nextInput = point.input;
        let nextMidi = point.midi;

        if (event.key === "ArrowUp") nextMidi = Math.min(midiValueMax, point.midi + 1);
        else if (event.key === "ArrowDown") nextMidi = Math.max(midiValueMin, point.midi - 1);
        else if (event.key === "ArrowLeft" && !endpoint) nextInput = Math.max(control.points[pointIndex - 1].input + 1, point.input - 1);
        else if (event.key === "ArrowRight" && !endpoint) nextInput = Math.min(control.points[pointIndex + 1].input - 1, point.input + 1);
        else if ((event.key === "Delete" || event.key === "Backspace") && !endpoint) {
            event.preventDefault();
            control.removePoint(point.input);
            setSelectedInput(control.points[Math.max(0, pointIndex - 1)].input);
            return;
        } else {
            return;
        }

        event.preventDefault();
        if (nextInput !== point.input || nextMidi !== point.midi) {
            control.movePoint(point.input, nextInput, nextMidi);
            setSelectedInput(nextInput);
        }
    };

    const currentMidi = control.calculateControlValue(inputValue);

    return <div className="automation-curve-editor">
        <svg
            className="automation-curve"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="group"
            aria-label={`${inputLabel} to MIDI control curve`}
        >
            <rect className="curve-plot-background" x={plot.left} y={plot.top} width={plotWidth} height={plotHeight}
                onPointerDown={(event) => {
                    const values = eventValues(event);
                    const existing = control.points.find(point => point.input === values.input);
                    if (existing) {
                        setSelectedInput(existing.input);
                    } else {
                        control.addPoint(values.input, values.midi);
                        setSelectedInput(values.input);
                    }
                }} />

            {midiTicks.map(tick => <g key={tick} className="curve-grid-line">
                <line x1={plot.left} x2={plot.left + plotWidth} y1={yForMidi(tick)} y2={yForMidi(tick)} />
                <text x={plot.left - 9} y={yForMidi(tick) + 4}>{tick}</text>
            </g>)}
            {Array.from({ length: inputValueMax + 1 }, (_, input) => <g key={input} className="curve-grid-line">
                <line x1={xForInput(input)} x2={xForInput(input)} y1={plot.top} y2={plot.top + plotHeight} />
                <text className="curve-input-tick" x={xForInput(input)} y={plot.top + plotHeight + 20}>{input}</text>
            </g>)}

            <text className="curve-axis-label curve-axis-label-y" transform={`translate(14 ${plot.top + plotHeight / 2}) rotate(-90)`}>MIDI value</text>
            <text className="curve-axis-label" x={plot.left + plotWidth / 2} y={chartHeight - 4}>{inputLabel}</text>

            <line className="curve-current-input" x1={xForInput(inputValue)} x2={xForInput(inputValue)} y1={plot.top} y2={plot.top + plotHeight} />
            <polyline className="automation-line" points={polylinePoints(control)} />
            <circle className="curve-current-output" cx={xForInput(inputValue)} cy={yForMidi(currentMidi)} r="6" />

            {points.map((point, pointIndex) => <circle
                // Points cannot cross their neighbours, so the sorted position is stable while
                // dragging horizontally. Keeping the DOM node preserves pointer capture and focus.
                key={pointIndex}
                className={`curve-point ${selectedPoint.input === point.input ? "selected" : ""}`}
                cx={xForInput(point.input)}
                cy={yForMidi(point.midi)}
                r="7"
                role="button"
                tabIndex={0}
                aria-label={`Input ${point.input}, MIDI ${point.midi}`}
                onFocus={() => setSelectedInput(point.input)}
                onKeyDown={(event) => handlePointKeyDown(event, point.input)}
                onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelectedInput(point.input);
                    dragInput.current = point.input;
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                    if (dragInput.current === null || !event.currentTarget.hasPointerCapture(event.pointerId)) {
                        return;
                    }
                    const draggedPoint = control.points.find(candidate => candidate.input === dragInput.current);
                    if (!draggedPoint) return;
                    const index = control.points.findIndex(candidate => candidate.input === draggedPoint.input);
                    const endpoint = draggedPoint.input === inputValueMin || draggedPoint.input === inputValueMax;
                    const values = eventValues(event);
                    const input = endpoint ? draggedPoint.input : Math.max(
                        control.points[index - 1].input + 1,
                        Math.min(control.points[index + 1].input - 1, values.input)
                    );
                    control.movePoint(draggedPoint.input, input, values.midi);
                    dragInput.current = input;
                    setSelectedInput(input);
                }}
                onPointerUp={(event) => {
                    dragInput.current = null;
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={() => { dragInput.current = null; }}
            />)}
        </svg>

        <div className="point-inspector" aria-label="Selected breakpoint">
            <div className="point-inspector-heading">Selected breakpoint</div>
            <label>
                Input
                <input type="number" min={minimumInput} max={maximumInput} step={1}
                    value={selectedPoint.input} disabled={isEndpoint}
                    onChange={(event) => {
                        if (Number.isInteger(event.target.valueAsNumber)) {
                            updateSelectedPoint(event.target.valueAsNumber, selectedPoint.midi);
                        }
                    }} />
            </label>
            <label>
                MIDI
                <input type="number" min={midiValueMin} max={midiValueMax} step={1}
                    value={selectedPoint.midi}
                    onChange={(event) => {
                        if (Number.isInteger(event.target.valueAsNumber)) {
                            updateSelectedPoint(selectedPoint.input,
                                Math.max(midiValueMin, Math.min(midiValueMax, event.target.valueAsNumber)));
                        }
                    }} />
            </label>
            <button className="remove-point-button" disabled={isEndpoint} onClick={removeSelectedPoint}>Remove point</button>
            {isEndpoint && <span className="endpoint-hint">Endpoints stay at input {selectedPoint.input}.</span>}
        </div>
    </div>;
};
