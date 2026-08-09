import React, { useState, useRef, useEffect } from "react";
import "./adaptizer-knob.scss";

interface AdaptizerKnobProps {
    min?: number;
    max?: number;
    step?: number;
    /** Where the knob starts. Required, because the owner of the input value has to be the one
     *  that decides it - a knob that picks its own start reports a value the rest of the app
     *  does not have, and the DAW hears the disagreement as a burst of two different values. */
    initialValue: number;
    onChange: (value: number) => void;
}

const AdaptizerKnob = ({ min = 0, max = 10, step = 1, initialValue, onChange }: AdaptizerKnobProps) => {
  const [value, setValue] = useState(initialValue);
  const angleRange = 270; // Knob rotation range (-135° to 135°)
  const startAngle = -135;
  const isDragging = useRef(false);

  const roundedValue = () => Math.round(value);

  useEffect(() => {
    onChange?.(roundedValue());
  }, [value]);

  // The fraction of the way through the range, not of the way to max - the two are only the
  // same while min is 0, and the knob would point at the wrong place for any other range.
  const valueFraction = (value: number) => (value - min) / (max - min);

  // Convert value to rotation angle
  const valueToAngle = (value: number) => startAngle + valueFraction(value) * angleRange;

  // Convert mouse movement to value change
  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const delta = e.movementY * -0.05; // Invert movement for natural feel
    setValue((prev) => Math.min(max, Math.max(min, prev + delta)));
  };

  // Start tracking movement
  const handleMouseDown = () => {
    isDragging.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Stop tracking movement
  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  return (
    // The ring tracks the same value/max fraction as valueToAngle, so the filled
    // arc always ends exactly where the indicator points.
    <div className="knob-container" style={{ "--knob-progress": valueFraction(value) } as React.CSSProperties}>
      <div className="knob-ring" />
      <div
        className="knob"
        onMouseDown={handleMouseDown}
        style={{ transform: `rotate(${valueToAngle(value)}deg)` }}
      >
        <div className="knob-indicator" />
      </div>
      <p className="knob-value">{roundedValue()}</p>
    </div>
  );
};

export default AdaptizerKnob;
