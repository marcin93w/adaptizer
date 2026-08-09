import {
  ControlDto,
  ControlPointDto,
  inputValueMax,
  inputValueMin,
  midiValueMax,
  midiValueMin
} from "../../shared/dtos";

const assertIntegerInRange = (name: string, value: number, min: number, max: number) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
};

const validatePoints = (points: readonly ControlPointDto[]): ControlPointDto[] => {
  if (!Array.isArray(points)) {
    throw new Error("Control points must be an array.");
  }

  const sorted = points.map(point => {
    if (point === null || typeof point !== "object") {
      throw new Error("Every control point must contain input and MIDI values.");
    }
    assertIntegerInRange("Point input", point.input, inputValueMin, inputValueMax);
    assertIntegerInRange("Point MIDI value", point.midi, midiValueMin, midiValueMax);
    return { input: point.input, midi: point.midi };
  }).sort((left, right) => left.input - right.input);

  if (sorted.length < 2 || sorted.length > inputValueMax - inputValueMin + 1) {
    throw new Error("A control curve must contain between 2 and 10 points.");
  }
  if (sorted[0].input !== inputValueMin || sorted[sorted.length - 1].input !== inputValueMax) {
    throw new Error(`A control curve must contain endpoints at inputs ${inputValueMin} and ${inputValueMax}.`);
  }
  if (sorted.some((point, index) => index > 0 && point.input === sorted[index - 1].input)) {
    throw new Error("A control curve cannot contain two points at the same input.");
  }

  return sorted;
};

export class Control {
  private _points: ControlPointDto[];
  private _controlChangedListeners: (() => void)[] = [];

  constructor(
    private readonly _controlNumber: number,
    points: readonly ControlPointDto[]
  ) {
    assertIntegerInRange("Control number", _controlNumber, 0, 127);
    this._points = validatePoints(points);
  }

  get controlNumber(): number {
    return this._controlNumber;
  }

  get points(): readonly ControlPointDto[] {
    return this._points.map(point => ({ ...point }));
  }

  addPoint(input: number, midi: number) {
    if (this._points.some(point => point.input === input)) {
      throw new Error(`A point already exists at input ${input}.`);
    }
    this._points = validatePoints([...this._points, { input, midi }]);
    this.notifyControlChanged();
  }

  movePoint(currentInput: number, input: number, midi: number) {
    const pointIndex = this._points.findIndex(point => point.input === currentInput);
    if (pointIndex < 0) {
      throw new Error(`There is no point at input ${currentInput}.`);
    }
    if ((currentInput === inputValueMin || currentInput === inputValueMax) && input !== currentInput) {
      throw new Error("Curve endpoints cannot be moved horizontally.");
    }
    if (input !== currentInput && this._points.some(point => point.input === input)) {
      throw new Error(`A point already exists at input ${input}.`);
    }

    const updated = this._points.map((point, index) =>
      index === pointIndex ? { input, midi } : point
    );
    this._points = validatePoints(updated);
    this.notifyControlChanged();
  }

  removePoint(input: number) {
    if (input === inputValueMin || input === inputValueMax) {
      throw new Error("Curve endpoints cannot be removed.");
    }
    if (!this._points.some(point => point.input === input)) {
      throw new Error(`There is no point at input ${input}.`);
    }
    this._points = validatePoints(this._points.filter(point => point.input !== input));
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
    const limitedInput = Math.max(inputValueMin, Math.min(inputValueMax, inputValue));
    const exactPoint = this._points.find(point => point.input === limitedInput);
    if (exactPoint) {
      return exactPoint.midi;
    }

    const upperIndex = this._points.findIndex(point => point.input > limitedInput);
    const lower = this._points[upperIndex - 1];
    const upper = this._points[upperIndex];
    const progress = (limitedInput - lower.input) / (upper.input - lower.input);
    return Math.round(lower.midi + progress * (upper.midi - lower.midi));
  }

  toDto(): ControlDto {
    return {
      controlNumber: this.controlNumber,
      points: this.points.map(point => ({ ...point }))
    };
  }

  static fromDto(dto: ControlDto): Control {
    if (dto === null || typeof dto !== "object") {
      throw new Error("Every control must contain a control number and curve points.");
    }
    return new Control(dto.controlNumber, dto.points);
  }

  /** A control the user has not shaped yet: the whole MIDI range across the whole input range. */
  static withDefaultCurve(controlNumber: number): Control {
    return new Control(controlNumber, [
      { input: inputValueMin, midi: midiValueMin },
      { input: inputValueMax, midi: midiValueMax }
    ]);
  }
}
