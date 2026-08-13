import { describe, expect, it, vi } from "vitest";
import { aControl } from "../../../testing/project-builders";

describe("the breakpoint curve transform", () => {
    it("returns exact breakpoint values", () => {
        const control = aControl({ points: [
            { input: 0, midi: 15 },
            { input: 4, midi: 100 },
            { input: 9, midi: 20 }
        ] });

        expect(control.calculateControlValue(0)).toBe(15);
        expect(control.calculateControlValue(4)).toBe(100);
        expect(control.calculateControlValue(9)).toBe(20);
    });

    it("linearly interpolates increasing, decreasing, and flat segments", () => {
        const control = aControl({ points: [
            { input: 0, midi: 0 },
            { input: 2, midi: 100 },
            { input: 4, midi: 20 },
            { input: 7, midi: 20 },
            { input: 9, midi: 120 }
        ] });

        expect(control.calculateControlValue(1)).toBe(50);
        expect(control.calculateControlValue(3)).toBe(60);
        expect(control.calculateControlValue(6)).toBe(20);
        expect(control.calculateControlValue(8)).toBe(70);
    });

    it("rounds half values up", () => {
        const control = aControl({ points: [{ input: 0, midi: 0 }, { input: 2, midi: 127 }, { input: 9, midi: 127 }] });

        expect(control.calculateControlValue(1)).toBe(64);
    });

    it("clamps inputs outside 0 to 9 onto the endpoints", () => {
        const control = aControl({ points: [{ input: 0, midi: 20 }, { input: 9, midi: 100 }] });

        expect(control.calculateControlValue(-50)).toBe(20);
        expect(control.calculateControlValue(100)).toBe(100);
    });
});

describe("the default control", () => {
    it("preserves the ten values rendered by export", () => {
        expect(Array.from({ length: 10 }, (_, input) => aControl().calculateControlValue(input)))
            .toEqual([0, 14, 28, 42, 56, 71, 85, 99, 113, 127]);
    });
});

describe("editing breakpoint curves", () => {
    it("sorts points deterministically", () => {
        const control = aControl({ points: [
            { input: 9, midi: 127 },
            { input: 5, midi: 60 },
            { input: 0, midi: 0 }
        ] });

        expect(control.points.map(point => point.input)).toEqual([0, 5, 9]);
    });

    it("adds, moves, and removes internal points", () => {
        const control = aControl();
        control.addPoint(3, 90);
        control.movePoint(3, 4, 80);
        expect(control.points).toEqual([
            { input: 0, midi: 0 },
            { input: 4, midi: 80 },
            { input: 9, midi: 127 }
        ]);

        control.removePoint(4);
        expect(control.points).toEqual([{ input: 0, midi: 0 }, { input: 9, midi: 127 }]);
    });

    it("emits exactly one change notification for each operation", () => {
        const control = aControl();
        const listener = vi.fn();
        control.registerControlChangedListener(listener);

        control.addPoint(3, 50);
        control.movePoint(3, 4, 60);
        control.removePoint(4);

        expect(listener).toHaveBeenCalledTimes(3);
    });

    it.each([
        { name: "missing input-zero endpoint", points: [{ input: 1, midi: 0 }, { input: 9, midi: 127 }] },
        { name: "missing input-nine endpoint", points: [{ input: 0, midi: 0 }, { input: 8, midi: 127 }] },
        { name: "duplicate input", points: [{ input: 0, midi: 0 }, { input: 4, midi: 20 }, { input: 4, midi: 40 }, { input: 9, midi: 127 }] },
        { name: "fractional input", points: [{ input: 0, midi: 0 }, { input: 4.5, midi: 20 }, { input: 9, midi: 127 }] },
        { name: "fractional MIDI value", points: [{ input: 0, midi: 0 }, { input: 4, midi: 20.5 }, { input: 9, midi: 127 }] },
        { name: "MIDI value below zero", points: [{ input: 0, midi: -1 }, { input: 9, midi: 127 }] },
        { name: "MIDI value above 127", points: [{ input: 0, midi: 0 }, { input: 9, midi: 128 }] }
    ])("rejects $name", ({ points }) => {
        expect(() => aControl({ points })).toThrow();
    });

    it("protects both endpoints", () => {
        const control = aControl();

        expect(() => control.removePoint(0)).toThrow("cannot be removed");
        expect(() => control.removePoint(9)).toThrow("cannot be removed");
        expect(() => control.movePoint(0, 1, 20)).toThrow("cannot be moved horizontally");
        expect(() => control.movePoint(9, 8, 100)).toThrow("cannot be moved horizontally");
    });

    it("does not expose mutable point storage", () => {
        const control = aControl();
        const points = control.points as { input: number; midi: number }[];
        points[0].midi = 100;
        points.push({ input: 4, midi: 40 });

        expect(control.points).toEqual([{ input: 0, midi: 0 }, { input: 9, midi: 127 }]);
    });
});
