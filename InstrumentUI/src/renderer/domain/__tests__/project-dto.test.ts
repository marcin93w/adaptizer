import { describe, expect, it } from "vitest";
import Project from "../project";
import { Control } from "../control";
import { Dimension, ProjectDto } from "../../../shared/dtos";
import { aControl, aProject } from "../../../testing/project-builders";

const savedAndReopened = (project: Project): Project =>
    Project.fromDto(JSON.parse(JSON.stringify(project.toDto())) as ProjectDto);

const valuesForEveryInput = (control: Control): number[] =>
    Array.from({ length: 10 }, (_, input) => control.calculateControlValue(input));

describe("saving and reopening a format-1 project", () => {
    it("preserves every control curve and the dimension", () => {
        const original = aProject({
            dimension: Dimension.MOVEMENT_SPEED,
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

        expect(reopened.getDimension()).toBe(Dimension.MOVEMENT_SPEED);
        expect(reopened.getControls().map(valuesForEveryInput))
            .toEqual(original.getControls().map(valuesForEveryInput));
    });

    // The name is the contract: the same spelling is typed into the catalog and compared in the
    // player, so a project file that re-cased or abbreviated one would break a layer this app
    // never sees. Spelled out here rather than looped over the enum, which would assert nothing.
    it.each([
        ["volume", Dimension.VOLUME],
        ["heartRate", Dimension.HEART_RATE],
        ["movementSpeed", Dimension.MOVEMENT_SPEED],
        ["intensity", Dimension.INTENSITY]
    ])("writes %s to the file and reads it back unchanged", (name, dimension) => {
        const saved = aProject({ dimension }).toDto();

        expect(saved.dimension).toBe(name);
        expect(Project.fromDto(JSON.parse(JSON.stringify(saved)) as ProjectDto).getDimension()).toBe(dimension);
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
            dimension: "intensity",
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

describe("starting a new project", () => {
    it("starts with one control covering the whole MIDI range", () => {
        const project = Project.newDefault();

        expect(project.getControls().map(control => control.controlNumber)).toEqual([1]);
        expect(valuesForEveryInput(project.getControls()[0])).toEqual([0, 14, 28, 42, 56, 71, 85, 99, 113, 127]);
    });

    it("does not add that control to a project opened from a file", () => {
        const empty = {
            formatVersion: 1,
            dimension: Dimension.INTENSITY,
            controls: []
        } as ProjectDto;

        expect(Project.fromDto(empty).getControls()).toEqual([]);
    });
});

describe("rejecting unsupported or invalid projects", () => {
    it("rejects an unsupported project format", () => {
        const unsupported = {
            formatVersion: 99,
            dimension: Dimension.INTENSITY,
            controls: []
        } as unknown as ProjectDto;

        expect(() => Project.fromDto(unsupported)).toThrow("format version 1");
    });

    // expression was offered by an earlier build and named something that never existed, so a
    // project saved by one is exactly the file this has to refuse rather than silently open.
    it.each(["expression", "Volume", "heart_rate", ""])
        ("rejects %o, which is not one of the four dimensions", (dimension) => {
            const unknownDimension = {
                formatVersion: 1,
                dimension,
                controls: []
            } as unknown as ProjectDto;

            expect(() => Project.fromDto(unknownDimension)).toThrow("unsupported dimension");
        });

    it("rejects invalid point data", () => {
        const invalid = {
            formatVersion: 1,
            dimension: Dimension.INTENSITY,
            controls: [{ controlNumber: 1, points: [{ input: 0, midi: 0 }, { input: 8, midi: 127 }] }]
        } as ProjectDto;

        expect(() => Project.fromDto(invalid)).toThrow("endpoints");
    });

    it("continues to ignore harmless unknown fields", () => {
        const withExtras = {
            formatVersion: 1,
            dimension: Dimension.VOLUME,
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
