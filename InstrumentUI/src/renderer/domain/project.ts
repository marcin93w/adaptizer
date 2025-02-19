import { Control } from "./control";
import { ControlDto, InputType, TransformType } from "../../shared/dtos";
import { ProjectDto } from "../../shared/dtos";

export class InputConfig {
  constructor(
    public type: InputType,
    public controls: Map<number, Control>,
  ) {}
}

class Project {
  constructor() {}

  private _config: InputConfig = new InputConfig(InputType.INTENSITY, new Map([[1, new Control(1, TransformType.LINEAR, 0, 9, 0, 127)]]));
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
      inputType: this._config.type,
      controls: this.getControls().map((control: Control) => control.toDto())
    }
  }

  static fromDto(dto: ProjectDto): Project {
    const project = new Project();
    project.setInputType(dto.inputType);
    dto.controls.forEach((controlDto: ControlDto) => {
      project.addControl(Control.fromDto(controlDto));
    });
    return project;
  }
}

export default Project;
