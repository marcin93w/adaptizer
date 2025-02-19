import { TransformType } from "./project";

export interface ControlDto {
  controlNumber: number;
  transformType: TransformType;
  inputMin: number;
  inputMax: number;
  midiMin: number;
  midiMax: number;
}

export class Control {
  constructor(
    private readonly _controlNumber: number,
    private _transformType: TransformType,
    private _inputMin: number,
    private _inputMax: number,
    private _midiMin: number,
    private _midiMax: number
  ) { }
  private _controlChangedListeners: (() => void)[] = [];

  get controlNumber(): number {
    return this._controlNumber;
  }

  get transformType(): TransformType {
    return this._transformType;
  }

  get inputMin(): number {
    return this._inputMin;
  }

  get inputMax(): number {
    return this._inputMax;
  }

  get midiMin(): number {
    return this._midiMin;
  }

  get midiMax(): number {
    return this._midiMax;
  }

  set inputMin(min: number) {
    this._inputMin = min;
    this.notifyControlChanged();
  }

  set inputMax(max: number) {
    this._inputMax = max;
    this.notifyControlChanged();
  }

  set midiMin(min: number) {
    this._midiMin = min;
    this.notifyControlChanged();
  }

  set midiMax(max: number) {
    this._midiMax = max;
    this.notifyControlChanged();
  }

  set transformType(type: TransformType) {
    this._transformType = type;
    this.notifyControlChanged();
  }

  registerControlChangedListener(listener: () => void) {
    this._controlChangedListeners.push(listener);
  }

  notifyControlChanged() {
    this._controlChangedListeners.forEach(listener => listener());
  }

  calculateControlValue(inputValue: number): number {
      const limitedInput = Math.max(this.inputMin, Math.min(this.inputMax, inputValue));
      let normalizedInput = (limitedInput - this.inputMin) / (this.inputMax - this.inputMin);
      
      if (this.transformType === TransformType.REVERSED_LINEAR) {
          normalizedInput = 1 - normalizedInput;
      }
      
      return Math.round(this.midiMin + normalizedInput * (this.midiMax - this.midiMin));
  }

  toDto(): ControlDto {
    return {
      controlNumber: this.controlNumber,
      transformType: this.transformType,
      inputMin: this.inputMin,
      inputMax: this.inputMax,
      midiMin: this.midiMin,
      midiMax: this.midiMax
    };
  }

  static fromDto(dto: ControlDto): Control {
    return new Control(dto.controlNumber, dto.transformType, dto.inputMin, dto.inputMax, dto.midiMin, dto.midiMax);
  }
}
