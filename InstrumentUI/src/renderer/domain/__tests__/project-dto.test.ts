import { describe, expect, it } from "vitest";
import Project from "../project";
import { Control } from "../control";
import { InputType, ProjectDto, TransformType } from "../../../shared/dtos";
import { aControl, aProject } from "../../../testing/project-builders";

// A .adz file is a raw JSON.stringify of ProjectDto (see main/project-manager.ts), so
// what these tests really cover is "the user saved their work and opened it again".

const savedAndReopened = (project: Project): Project =>
    Project.fromDto(JSON.parse(JSON.stringify(project.toDto())) as ProjectDto);

const valuesForEveryInput = (control: Control): number[] =>
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(input => control.calculateControlValue(input));

describe("saving and reopening a project", () => {
    it("gives every control the same CC values it had before", () => {
        // Asserted through the transform rather than field by field: matching fields
        // are only evidence, but matching output IS what the user means by "it saved".
        const original = aProject({
            inputType: InputType.EXPRESSION,
            controls: [
                aControl({ cc: 1, inputRange: [0, 9], midiRange: [0, 127] }),
                aControl({ cc: 4, transform: TransformType.REVERSED_LINEAR, inputRange: [3, 8], midiRange: [20, 100] }),
                aControl({ cc: 7, inputRange: [6, 7], midiRange: [50, 127] })
            ]
        });

        const reopened = savedAndReopened(original);

        expect(reopened.getInputType()).toBe(InputType.EXPRESSION);
        expect(reopened.getControls().map(valuesForEveryInput))
            .toEqual(original.getControls().map(valuesForEveryInput));
    });

    it("holds exactly the controls that were saved, and no others", () => {
        // A project always starts with a default CC 1 control. Loading must not leave it
        // behind alongside the saved ones, or the DAW receives CC 1 messages the user
        // never configured. See docs/testing-strategy.md, defect a.
        const saved = aProject({ controls: [aControl({ cc: 7 })] });

        const reopened = savedAndReopened(saved);

        expect(reopened.getControls().map(control => control.controlNumber)).toEqual([7]);
    });

    it("keeps a control the user added after opening", () => {
        const project = aProject({ controls: [aControl({ cc: 2 })] });
        project.addControl(aControl({ cc: 5 }));

        const reopened = savedAndReopened(project);

        expect(reopened.getControls().map(control => control.controlNumber)).toEqual([2, 5]);
    });
});

describe("the .adz file format", () => {
    it("uses the field names every already-saved project was written with", () => {
        // The one place where structure IS behavior: renaming a key silently breaks every
        // .adz a user already has. Shape cross-checked against the real sample project at
        // Samples/Ableton/Adaptizer-sample/Adaptizer-sample.adz.
        const project = aProject({
            inputType: InputType.INTENSITY,
            controls: [aControl({
                cc: 1,
                transform: TransformType.REVERSED_LINEAR,
                inputRange: [3, 4],
                midiRange: [0, 127]
            })]
        });

        expect(project.toDto()).toEqual({
            inputType: "intensity",
            controls: [{
                controlNumber: 1,
                transformType: "reversed-linear",
                inputMin: 3,
                inputMax: 4,
                midiMin: 0,
                midiMax: 127
            }]
        });
    });

    it("opens a project saved by an older version that stored extra fields", () => {
        // .adz files are plain JSON and get hand-edited; project-manager.ts parses them
        // with no validation, so an unknown key must not take the app down.
        const storedWithExtras = {
            inputType: InputType.VOLUME,
            projectNotes: "written by some future version",
            controls: [{
                controlNumber: 3,
                transformType: TransformType.LINEAR,
                inputMin: 0,
                inputMax: 9,
                midiMin: 0,
                midiMax: 127,
                colour: "orange"
            }]
        } as unknown as ProjectDto;

        const project = Project.fromDto(storedWithExtras);

        expect(project.getInputType()).toBe(InputType.VOLUME);
        expect(project.getControls()).toHaveLength(1);
        expect(project.getControls()[0].calculateControlValue(9)).toBe(127);
    });
});
