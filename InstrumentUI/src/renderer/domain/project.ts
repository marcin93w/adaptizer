import { Control } from "./control";
import { ControlDto, InputType, projectFormatVersion, ProjectDto } from "../../shared/dtos";

export class InputConfig {
  constructor(
    public type: InputType,
    public controls: Map<number, Control>,
  ) {}
}

class Project {
  // Controls always go through addControl, so every one of them notifies about its changes
  constructor(controls: Control[] = [new Control(1, [{ input: 0, midi: 0 }, { input: 9, midi: 127 }])]) {
    controls.forEach(control => this.addControl(control));
  }

  private _config: InputConfig = new InputConfig(InputType.INTENSITY, new Map());
  private _projectUpdatedListeners: (() => void)[] = [];
  private _controlAddedListeners: ((control: Control) => void)[] = [];

  setInputType(inputType: InputType) {
    this._config.type = inputType;
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

  getInputType() {
    return this._config.type;
  }

  getControls(): Control[] {
    return Array.from(this._config.controls.values());
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
      inputType: this._config.type,
      controls: this.getControls().map((control: Control) => control.toDto())
    }
  }

  static fromDto(dto: ProjectDto): Project {
    if (dto === null || typeof dto !== "object") {
      throw new Error("The project file does not contain a project.");
    }
    if (dto.formatVersion !== projectFormatVersion) {
      throw new Error(`Unsupported project format. InstrumentUI requires format version ${projectFormatVersion}.`);
    }
    if (!Object.values(InputType).includes(dto.inputType)) {
      throw new Error("The project contains an unsupported input type.");
    }
    if (!Array.isArray(dto.controls)) {
      throw new Error("The project controls must be an array.");
    }
    const project = new Project(dto.controls.map((controlDto: ControlDto) => Control.fromDto(controlDto)));
    project.setInputType(dto.inputType);
    return project;
  }
}

export default Project;
