import { ControlDto } from "../../shared/dtos";
import { TransformType } from "../../shared/dtos";

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

  unregisterControlChangedListener(listener: () => void) {
    this._controlChangedListeners = this._controlChangedListeners.filter(l => l !== listener);
  }

  notifyControlChanged() {
    this._controlChangedListeners.forEach(listener => listener());
  }

  calculateControlValue(inputValue: number): number {
      const limitedInput = Math.max(this.inputMin, Math.min(this.inputMax, inputValue));
      // Both range thumbs can sit on the same value, which would divide by zero and send
      // NaN to a port that rejects it. The input has reached the top of its range, so a
      // collapsed range reads as full scale - and the reversal below mirrors it to midiMin.
      let normalizedInput = this.inputMax === this.inputMin
          ? 1
          : (limitedInput - this.inputMin) / (this.inputMax - this.inputMin);

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
