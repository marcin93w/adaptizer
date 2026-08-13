import { Control } from "../renderer/domain/control";
import Project from "../renderer/domain/project";
import { ControlPointDto, Dimension } from "../shared/dtos";

// Named specs keep curve-heavy tests readable and make their defaults explicit.

export interface ControlSpec {
    cc?: number;
    points?: ControlPointDto[];
}

/** A control with the app's defaults for anything not specified. */
export const aControl = (spec: ControlSpec = {}): Control => {
    return new Control(
        spec.cc ?? 1,
        spec.points ?? [{ input: 0, midi: 0 }, { input: 9, midi: 127 }]
    );
};

export interface ProjectSpec {
    dimension?: Dimension;
    controls?: Control[];
}

/** A project holding exactly the controls given, or one default control. */
export const aProject = (spec: ProjectSpec = {}): Project => {
    const project = new Project(spec.controls ?? [aControl()]);
    if (spec.dimension !== undefined) {
        project.setDimension(spec.dimension);
    }
    return project;
};
