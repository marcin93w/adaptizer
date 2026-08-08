import { Control } from "../renderer/domain/control";
import Project from "../renderer/domain/project";
import { InputType, TransformType } from "../shared/dtos";

// `new Control(3, TransformType.REVERSED_LINEAR, 2, 7, 10, 90)` is six positional
// numbers. Across thirty rows that is unreadable, and unreadable tests get deleted
// rather than fixed.

export interface ControlSpec {
    cc?: number;
    transform?: TransformType;
    inputRange?: [number, number];
    midiRange?: [number, number];
}

/** A control with the app's defaults for anything not specified. */
export const aControl = (spec: ControlSpec = {}): Control => {
    const [inputMin, inputMax] = spec.inputRange ?? [0, 9];
    const [midiMin, midiMax] = spec.midiRange ?? [0, 127];
    return new Control(
        spec.cc ?? 1,
        spec.transform ?? TransformType.LINEAR,
        inputMin,
        inputMax,
        midiMin,
        midiMax
    );
};

export interface ProjectSpec {
    inputType?: InputType;
    controls?: Control[];
}

/** A project holding exactly the controls given, or one default control. */
export const aProject = (spec: ProjectSpec = {}): Project => {
    const project = new Project(spec.controls ?? [aControl()]);
    if (spec.inputType !== undefined) {
        project.setInputType(spec.inputType);
    }
    return project;
};
