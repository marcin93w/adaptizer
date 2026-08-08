import { describe, expect, it } from "vitest";
import { TransformType } from "../../../shared/dtos";
import { aControl } from "../../../testing/project-builders";

// The input value the listener's context produces (0..9) becomes the MIDI CC value the
// DAW hears (0..127). This one number decides every live audition and every one of the
// ten exported DASH tracks, and getting it wrong is silent - the tracks all still render.
//
// The table below is ported from Instrument/adaptizer.test.py, the Python prototype this
// app descends from. It is the only logic in the repo with an independent oracle, so
// these expectations were written by someone else, against another implementation.
//
// PORTING NOTE - the Python parameter names are misleading. The test calls
//   add_control(1, min_in, max_in, input_type, min_out, max_out, transform_type)
// against the signature (adaptizer.py:34)
//   add_control(controlTypeNumber, minValue, maxValue, inputType, minInput, maxInput, transformType)
// so `min_in`/`max_in` are really the MIDI range and `min_out`/`max_out` the input range.
// If a row here fails, re-check that mapping before touching control.ts.
//
// 30 of the Python table's 38 rows appear below. The other 8 use BINARY_ON / BINARY_OFF,
// transform types this TypeScript app does not have - a real feature difference between
// the prototype and the shipped app, not an oversight in this port. (Instrument/conf.adp
// still uses BINARY_ON, so that sample cannot be loaded by InstrumentUI at all.)

type Row = [
    midiMin: number,
    midiMax: number,
    inputMin: number,
    inputMax: number,
    transform: TransformType,
    input: number,
    expected: number
];

const { LINEAR, REVERSED_LINEAR } = TransformType;

const goldenRows: Row[] = [
    [0, 127, 0, 10, LINEAR, 5, 64],
    [0, 127, 0, 10, LINEAR, 0, 0],
    [0, 127, 0, 10, LINEAR, 10, 127],
    [0, 127, 0, 10, LINEAR, 1, 13],
    [60, 80, 0, 10, LINEAR, 1, 62],
    [60, 80, 0, 10, LINEAR, 9, 78],
    [0, 127, 0, 3, LINEAR, 1, 42],
    [0, 127, 0, 3, LINEAR, 3, 127],
    [0, 127, 0, 3, LINEAR, 10, 127],
    [0, 127, 5, 10, LINEAR, 5, 0],
    [0, 127, 5, 10, LINEAR, 2, 0],
    [0, 127, 5, 10, LINEAR, 9, 102],
    [100, 105, 5, 10, LINEAR, 9, 104],
    [0, 1, 5, 6, LINEAR, 5, 0],
    [0, 1, 5, 6, LINEAR, 6, 1],

    [0, 127, 0, 10, REVERSED_LINEAR, 5, 64],
    [0, 127, 0, 10, REVERSED_LINEAR, 0, 127],
    [0, 127, 0, 10, REVERSED_LINEAR, 10, 0],
    [0, 127, 0, 10, REVERSED_LINEAR, 9, 13],
    [60, 80, 0, 10, REVERSED_LINEAR, 1, 78],
    [60, 80, 0, 10, REVERSED_LINEAR, 9, 62],
    [0, 127, 0, 3, REVERSED_LINEAR, 1, 85],
    [0, 127, 0, 3, REVERSED_LINEAR, 3, 0],
    [0, 127, 0, 3, REVERSED_LINEAR, 10, 0],
    [0, 127, 5, 10, REVERSED_LINEAR, 5, 127],
    [0, 127, 5, 10, REVERSED_LINEAR, 2, 127],
    [0, 127, 5, 10, REVERSED_LINEAR, 9, 25],
    [100, 105, 5, 10, REVERSED_LINEAR, 9, 101],
    [0, 1, 5, 6, REVERSED_LINEAR, 5, 1],
    [0, 1, 5, 6, REVERSED_LINEAR, 6, 0]
];

const valueFor = (row: Row): number => {
    const [midiMin, midiMax, inputMin, inputMax, transform, input] = row;
    return aControl({
        transform,
        inputRange: [inputMin, inputMax],
        midiRange: [midiMin, midiMax]
    }).calculateControlValue(input);
};

describe("the input to CC transform", () => {
    it.each(goldenRows)(
        "CC %i..%i over input %i..%i, %s, input %i -> %i",
        (...row: Row) => {
            expect(valueFor(row)).toBe(row[6]);
        }
    );
});

describe("the rules the table encodes", () => {
    it("maps the ends of the input range onto the ends of the MIDI range", () => {
        const control = aControl({ inputRange: [0, 9], midiRange: [20, 100] });

        expect(control.calculateControlValue(0)).toBe(20);
        expect(control.calculateControlValue(9)).toBe(100);
    });

    it("clamps an input above the range instead of extrapolating past the MIDI ceiling", () => {
        const control = aControl({ inputRange: [0, 3], midiRange: [0, 127] });

        expect(control.calculateControlValue(10)).toBe(127);
        expect(control.calculateControlValue(100)).toBe(127);
    });

    it("clamps an input below the range instead of going under the MIDI floor", () => {
        const control = aControl({ inputRange: [5, 10], midiRange: [0, 127] });

        expect(control.calculateControlValue(2)).toBe(0);
        expect(control.calculateControlValue(-50)).toBe(0);
    });

    it("mirrors linear exactly when reversed", () => {
        const forward = aControl({ inputRange: [0, 9], midiRange: [0, 127] });
        const reversed = aControl({
            transform: REVERSED_LINEAR,
            inputRange: [0, 9],
            midiRange: [0, 127]
        });

        for (let input = 0; input <= 9; input++) {
            expect(reversed.calculateControlValue(input))
                .toBe(forward.calculateControlValue(9 - input));
        }
    });

    it("acts as a switch when the MIDI range is a single step", () => {
        const control = aControl({ inputRange: [5, 6], midiRange: [0, 1] });

        expect(control.calculateControlValue(5)).toBe(0);
        expect(control.calculateControlValue(6)).toBe(1);
    });

    it("rounds a half value up, so the CC does not drift by one", () => {
        // 5 of 0..10 across 0..127 lands exactly on 63.5. Switching to Math.trunc or
        // toFixed would quietly shift values across the whole range.
        const control = aControl({ inputRange: [0, 10], midiRange: [0, 127] });

        expect(control.calculateControlValue(5)).toBe(64);
    });
});

describe("the default control", () => {
    // A new control is (LINEAR, input 0..9, CC 0..127). These ten numbers ARE the ten
    // exported DASH tracks - track n is rendered with the DAW at value n - and the
    // mobile player switches between them by intensity. Nothing else pins them.
    it("turns the ten input levels into the ten CC values the export renders", () => {
        const control = aControl();

        const perLevel = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
            .map(input => control.calculateControlValue(input));

        expect(perLevel).toEqual([0, 14, 28, 42, 56, 71, 85, 99, 113, 127]);
    });
});

describe("an input range collapsed to a single point", () => {
    // Nothing stops the user dragging both input-range thumbs onto the same value, and it
    // is a legitimate setting - "when intensity is exactly 5, send this". It used to
    // divide by zero, so NaN reached the port, Web MIDI threw on the non-integer data and
    // the live audition stayed dead until the app was restarted.

    it("sends the top of the MIDI range", () => {
        const control = aControl({ inputRange: [5, 5], midiRange: [0, 127] });

        expect(control.calculateControlValue(5)).toBe(127);
    });

    it("sends the bottom of the MIDI range when reversed", () => {
        const control = aControl({
            transform: REVERSED_LINEAR,
            inputRange: [5, 5],
            midiRange: [0, 127]
        });

        expect(control.calculateControlValue(5)).toBe(0);
    });

    it("sends that same value whatever the input, since every input clamps onto the point", () => {
        const control = aControl({ inputRange: [5, 5], midiRange: [20, 90] });

        expect([0, 5, 9].map(input => control.calculateControlValue(input)))
            .toEqual([90, 90, 90]);
    });
});
