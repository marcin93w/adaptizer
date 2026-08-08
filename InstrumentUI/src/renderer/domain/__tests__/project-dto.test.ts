import { describe, expect, it } from "vitest";
import Project from "../project";
import { Control } from "../control";
import { InputType, ProjectDto } from "../../../shared/dtos";
import { aControl, aProject } from "../../../testing/project-builders";

const savedAndReopened = (project: Project): Project =>
    Project.fromDto(JSON.parse(JSON.stringify(project.toDto())) as ProjectDto);

const valuesForEveryInput = (control: Control): number[] =>
    Array.from({ length: 10 }, (_, input) => control.calculateControlValue(input));

describe("saving and reopening a format-1 project", () => {
    it("preserves every control curve and the input type", () => {
        const original = aProject({
            inputType: InputType.EXPRESSION,
            controls: [
                aControl({ cc: 1 }),
                aControl({ cc: 4, points: [
                    { input: 0, midi: 100 },
                    { input: 3, midi: 100 },
                    { input: 8, midi: 20 },
                    { input: 9, midi: 20 }
                ] }),
                aControl({ cc: 7, points: [{ input: 0, midi: 50 }, { input: 6, midi: 50 }, { input: 9, midi: 127 }] })
            ]
        });

        const reopened = savedAndReopened(original);

        expect(reopened.getInputType()).toBe(InputType.EXPRESSION);
        expect(reopened.getControls().map(valuesForEveryInput))
            .toEqual(original.getControls().map(valuesForEveryInput));
    });

    it("holds exactly the controls that were saved", () => {
        const reopened = savedAndReopened(aProject({ controls: [aControl({ cc: 7 })] }));
        expect(reopened.getControls().map(control => control.controlNumber)).toEqual([7]);
    });

    it("writes the version-1 shape with sorted point arrays", () => {
        const project = aProject({ controls: [aControl({ cc: 3, points: [
            { input: 9, midi: 10 },
            { input: 4, midi: 80 },
            { input: 0, midi: 120 }
        ] })] });

        expect(project.toDto()).toEqual({
            formatVersion: 1,
            inputType: "intensity",
            controls: [{
                controlNumber: 3,
                points: [
                    { input: 0, midi: 120 },
                    { input: 4, midi: 80 },
                    { input: 9, midi: 10 }
                ]
            }]
        });
    });
});

describe("rejecting unsupported or invalid projects", () => {
    it("rejects an unsupported project format", () => {
        const unsupported = {
            formatVersion: 99,
            inputType: InputType.INTENSITY,
            controls: []
        } as unknown as ProjectDto;

        expect(() => Project.fromDto(unsupported)).toThrow("format version 1");
    });

    it("rejects invalid point data", () => {
        const invalid = {
            formatVersion: 1,
            inputType: InputType.INTENSITY,
            controls: [{ controlNumber: 1, points: [{ input: 0, midi: 0 }, { input: 8, midi: 127 }] }]
        } as ProjectDto;

        expect(() => Project.fromDto(invalid)).toThrow("endpoints");
    });

    it("continues to ignore harmless unknown fields", () => {
        const withExtras = {
            formatVersion: 1,
            inputType: InputType.VOLUME,
            projectNotes: "future metadata",
            controls: [{
                controlNumber: 3,
                points: [{ input: 0, midi: 0 }, { input: 9, midi: 127 }],
                colour: "orange"
            }]
        } as unknown as ProjectDto;

        expect(Project.fromDto(withExtras).getControls()[0].calculateControlValue(9)).toBe(127);
    });
});
