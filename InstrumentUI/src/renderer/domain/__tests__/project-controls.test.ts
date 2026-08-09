import { describe, expect, it } from "vitest";
import { Control } from "../control";
import { aControl, aProject } from "../../../testing/project-builders";

describe("adding a control to a project", () => {
    it("never replaces a control the user already configured", () => {
        const shaped = aControl({ cc: 3, points: [{ input: 0, midi: 100 }, { input: 9, midi: 20 }] });
        const project = aProject({ controls: [aControl({ cc: 1 }), shaped] });

        project.addControl(Control.withDefaultCurve(project.nextControlNumber()));

        expect(project.getControls().map(control => control.controlNumber)).toEqual([1, 3, 4]);
        expect(project.getControls()[1].calculateControlValue(0)).toBe(100);
        expect(project.getControls()[1].calculateControlValue(9)).toBe(20);
    });

    it("numbers the first control of an empty project 1", () => {
        expect(aProject({ controls: [] }).nextControlNumber()).toBe(1);
    });

    it("refuses to hand out a number no MIDI controller can carry", () => {
        const project = aProject({ controls: [aControl({ cc: 127 })] });

        expect(() => project.nextControlNumber()).toThrow("above number 127");
    });
});
