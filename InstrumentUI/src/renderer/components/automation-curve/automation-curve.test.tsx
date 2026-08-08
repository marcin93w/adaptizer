import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { aControl } from "../../../testing/project-builders";
import { AutomationCurve } from "./automation-curve";
import { ControlSummary } from "../control-summary/control-summary";

const renderCurve = (control = aControl(), inputValue = 3) => {
    const result = render(<AutomationCurve control={control} inputValue={inputValue} inputLabel="Intensity" />);
    const svg = screen.getByRole("group", { name: "Intensity to MIDI control curve" });
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
        x: 0, y: 0, left: 0, top: 0, right: 720, bottom: 300,
        width: 720, height: 300, toJSON: () => ({})
    });
    return { control, svg, ...result };
};

describe("editing an automation curve", () => {
    it("adds a snapped breakpoint by clicking empty chart space", () => {
        const { control, container } = renderCurve();
        const plot = container.querySelector(".curve-plot-background")!;

        fireEvent.pointerDown(plot, { clientX: 342, clientY: 136 });

        expect(control.points).toEqual([
            { input: 0, midi: 0 },
            { input: 4, midi: 64 },
            { input: 9, midi: 127 }
        ]);
        expect(screen.getByRole("button", { name: "Input 4, MIDI 64" })).toBeInTheDocument();
    });

    it("edits the selected breakpoint with exact numeric fields", () => {
        const control = aControl({ points: [{ input: 0, midi: 0 }, { input: 4, midi: 64 }, { input: 9, midi: 127 }] });
        renderCurve(control);
        fireEvent.focus(screen.getByRole("button", { name: "Input 4, MIDI 64" }));

        fireEvent.change(screen.getByLabelText("Input"), { target: { value: "5" } });
        fireEvent.change(screen.getByLabelText("MIDI"), { target: { value: "80" } });

        expect(control.points).toEqual([
            { input: 0, midi: 0 },
            { input: 5, midi: 80 },
            { input: 9, midi: 127 }
        ]);
    });

    it("drags an internal point within its neighbours", () => {
        const control = aControl({ points: [{ input: 0, midi: 0 }, { input: 4, midi: 64 }, { input: 9, midi: 127 }] });
        renderCurve(control);
        const handle = screen.getByRole("button", { name: "Input 4, MIDI 64" });
        let capturedPointer: number | null = null;
        Object.defineProperties(handle, {
            setPointerCapture: { value: (pointerId: number) => { capturedPointer = pointerId; } },
            hasPointerCapture: { value: (pointerId: number) => capturedPointer === pointerId },
            releasePointerCapture: { value: () => { capturedPointer = null; } }
        });

        fireEvent.pointerDown(handle, { pointerId: 7, clientX: 342, clientY: 136 });
        fireEvent.pointerMove(handle, { pointerId: 7, clientX: 414, clientY: 91 });
        fireEvent.pointerMove(handle, { pointerId: 7, clientX: 486, clientY: 67 });
        fireEvent.pointerUp(handle, { pointerId: 7 });

        expect(control.points).toEqual([
            { input: 0, midi: 0 },
            { input: 6, midi: 100 },
            { input: 9, midi: 127 }
        ]);
    });

    it("supports keyboard nudging and removal", () => {
        const control = aControl({ points: [{ input: 0, midi: 0 }, { input: 4, midi: 64 }, { input: 9, midi: 127 }] });
        renderCurve(control);
        const handle = screen.getByRole("button", { name: "Input 4, MIDI 64" });

        fireEvent.keyDown(handle, { key: "ArrowUp" });
        const nudged = screen.getByRole("button", { name: "Input 4, MIDI 65" });
        fireEvent.keyDown(nudged, { key: "ArrowRight" });
        fireEvent.keyDown(screen.getByRole("button", { name: "Input 5, MIDI 65" }), { key: "Delete" });

        expect(control.points).toEqual([{ input: 0, midi: 0 }, { input: 9, midi: 127 }]);
    });

    it("keeps endpoint positions and disables their removal", () => {
        const { control } = renderCurve();
        const endpoint = screen.getByRole("button", { name: "Input 0, MIDI 0" });
        fireEvent.focus(endpoint);

        expect(screen.getByLabelText("Input")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Remove point" })).toBeDisabled();
        fireEvent.keyDown(endpoint, { key: "Delete" });
        fireEvent.keyDown(endpoint, { key: "ArrowRight" });

        expect(control.points[0]).toEqual({ input: 0, midi: 0 });
    });

    it("shows the current input guide and evaluated output", () => {
        const { container } = renderCurve(aControl(), 3);

        expect(container.querySelector(".curve-current-input")).toHaveAttribute("x1", "270");
        expect(container.querySelector(".curve-current-output")).toBeInTheDocument();
    });
});

describe("the control-list curve preview", () => {
    it("updates when its owning control changes", () => {
        const control = aControl();
        const { container } = render(<ControlSummary control={control} inputValue={4} isSelected={true} onSelect={() => {}} />);
        const before = container.querySelector(".curve-preview-line")!.getAttribute("points");

        act(() => control.movePoint(9, 9, 20));

        expect(container.querySelector(".curve-preview-line")!.getAttribute("points")).not.toBe(before);
        expect(container.querySelector(".cell-value")).toHaveTextContent("9");
    });
});
