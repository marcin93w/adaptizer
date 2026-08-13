import { Control } from "./control";
import { ControlDto, Dimension, midiControlNumberMax, projectFormatVersion, ProjectDto } from "../../shared/dtos";

export class ProjectConfig {
  constructor(
    public dimension: Dimension,
    public controls: Map<number, Control>,
  ) {}
}

class Project {
  // Controls always go through addControl, so every one of them notifies about its changes
  constructor(controls: Control[] = []) {
    controls.forEach(control => this.addControl(control));
  }

  // A brand-new project starts with one control so there is something to audition. That
  // belongs to "the user picked New", not to the constructor - an opened .adz holds exactly
  // the controls it was saved with, and a default here would add a CC nobody configured.
  static newDefault(): Project {
    return new Project([Control.withDefaultCurve(1)]);
  }

  private _config: ProjectConfig = new ProjectConfig(Dimension.INTENSITY, new Map());
  private _projectUpdatedListeners: (() => void)[] = [];
  private _controlAddedListeners: ((control: Control) => void)[] = [];

  setDimension(dimension: Dimension) {
    this._config.dimension = dimension;
    this.notifyProjectUpdated();
  }

  addControl(control: Control) {
    this._config.controls.set(control.controlNumber, control);
    control.registerControlChangedListener(() => {
      this.notifyProjectUpdated();
    });
    this.notifyControlAdded(control);
    this.notifyProjectUpdated();
  }

  getDimension() {
    return this._config.dimension;
  }

  getControls(): Control[] {
    return Array.from(this._config.controls.values());
  }

  // Controls are keyed by CC number, so the next one has to clear the highest number in use.
  // Counting them instead silently replaces a configured control as soon as the numbers have
  // gaps: a project holding CC 1 and CC 3 would hand out 3 again and rebuild it from scratch.
  nextControlNumber(): number {
    const highest = this.getControls()
      .reduce((highest, control) => Math.max(highest, control.controlNumber), 0);
    if (highest >= midiControlNumberMax) {
      throw new Error(`A project cannot hold a control above number ${midiControlNumberMax}.`);
    }
    return highest + 1;
  }

  registerProjectUpdatedListener(listener: () => void) {
    this._projectUpdatedListeners.push(listener);
  }

  registerControlAddedListener(listener: (control: Control) => void) {
    this._controlAddedListeners.push(listener);
  }

  private notifyProjectUpdated() {
    this._projectUpdatedListeners.forEach(listener => listener());
  }

  private notifyControlAdded(control: Control) {
    this._controlAddedListeners.forEach(listener => listener(control));
  }

  toDto(): ProjectDto {
    return {
      formatVersion: projectFormatVersion,
      dimension: this._config.dimension,
      controls: this.getControls().map((control: Control) => control.toDto())
    }
  }

  static fromDto(dto: ProjectDto): Project {
    if (dto === null || typeof dto !== "object") {
      throw new Error("The project file does not contain a project.");
    }
    if (dto.formatVersion !== projectFormatVersion) {
      throw new Error(`Unsupported project format. Instrument requires format version ${projectFormatVersion}.`);
    }
    if (!Object.values(Dimension).includes(dto.dimension)) {
      throw new Error("The project contains an unsupported dimension.");
    }
    if (!Array.isArray(dto.controls)) {
      throw new Error("The project controls must be an array.");
    }
    const project = new Project(dto.controls.map((controlDto: ControlDto) => Control.fromDto(controlDto)));
    project.setDimension(dto.dimension);
    return project;
  }
}

export default Project;
