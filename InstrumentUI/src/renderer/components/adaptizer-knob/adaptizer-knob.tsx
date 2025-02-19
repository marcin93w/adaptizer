import React, { useState, useRef, useEffect } from "react";
import "./adaptizer-knob.scss";

interface AdaptizerKnobProps {
    min?: number;
    max?: number;
    step?: number;
    onChange: (value: number) => void;
}

const AdaptizerKnob = ({ min = 0, max = 10, step = 1, onChange }: AdaptizerKnobProps) => {
  const [value, setValue] = useState((max - min) / 2); // Default to midpoint
  const angleRange = 270; // Knob rotation range (-135° to 135°)
  const startAngle = -135;
  const isDragging = useRef(false);

  const roundedValue = () => Math.round(value);

  useEffect(() => {
    onChange?.(roundedValue());
  }, [value]);

  // Convert value to rotation angle
  const valueToAngle = (value) => startAngle + (value / max) * angleRange;

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
    <div className="knob-container">
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
