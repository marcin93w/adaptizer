import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./app";
import { Dimension } from "../shared/dtos";
import { createFakeElectronApi } from "../testing/fake-electron-api";
import { createFakeMidiPort } from "../testing/fake-midi-port";
import { aControl, aProject } from "../testing/project-builders";

// Three things only exist at this level: the project reaching the main process so it can be
// saved, the main process pushing an opened project back, and the loopMIDI onboarding loop -
// the warning a first-time user meets before anything else in the app works.

const setUp = async (options: { portPresent?: boolean } = {}) => {
    const midi = createFakeMidiPort({ portPresent: options.portPresent ?? true });
    const api = createFakeElectronApi();
    await act(async () => {
        render(<App midiPort={midi} electronApi={api} />);
    });
    return { midi, api };
};

const isControlOnScreen = (controlNumber: number) =>
    screen.queryAllByText(`CC ${controlNumber}`).length > 0;

const midiWarning = () => screen.queryByText(/no MIDI port named/);

describe("keeping the main process up to date", () => {
    it("reports every edit, so the project on disk can match the screen", async () => {
        const { api } = await setUp();

        fireEvent.click(screen.getByText("+ Add control"));
        fireEvent.click(screen.getByText("Volume"));

        const lastSent = api.sentProjects[api.sentProjects.length - 1];
        expect(lastSent.controls.map(control => control.controlNumber)).toEqual([1, 2]);
        expect(lastSent.dimension).toBe(Dimension.VOLUME);
    });

    it("shows the project the main process opened instead of the one on screen", async () => {
        const { api } = await setUp();
        const opened = aProject({ controls: [aControl({ cc: 5 })], dimension: Dimension.HEART_RATE }).toDto();

        await act(async () => api.emitProjectOpened(opened));

        expect(isControlOnScreen(5)).toBe(true);
        expect(isControlOnScreen(1)).toBe(false);
    });
});

describe("the dimension a project was authored against", () => {
    // The producer's decision has to survive the trip through the main process and back, which
    // is the only place the whole round trip exists: the renderer hands the project over, a
    // file is what comes back. Anything narrower than this misses a field dropped in between.
    it("comes back after saving and reopening, with the controls it was saved with", async () => {
        const { api } = await setUp();

        fireEvent.click(screen.getByRole("radio", { name: "Movement speed" }));
        const saved = api.sentProjects[api.sentProjects.length - 1];
        // Carry on authoring after the save, so what comes back has to be read out of the file
        // rather than being whatever the screen happened to be left on.
        fireEvent.click(screen.getByRole("radio", { name: "Volume" }));
        const reopenedFromDisk = JSON.parse(JSON.stringify(saved));
        await act(async () => api.emitProjectOpened(reopenedFromDisk));

        expect(screen.getByRole("radio", { name: "Movement speed" })).toBeChecked();
        expect(screen.getByRole("group", { name: "Movement speed to MIDI control curve" })).toBeInTheDocument();
        expect(isControlOnScreen(1)).toBe(true);
    });

    it("leaves the controls alone when it changes, so switching is never a re-authoring job", async () => {
        const { api } = await setUp();
        const lastSent = () => api.sentProjects[api.sentProjects.length - 1];

        fireEvent.click(screen.getByRole("radio", { name: "Volume" }));
        const before = lastSent().controls;
        fireEvent.click(screen.getByRole("radio", { name: "Heart rate" }));

        expect(lastSent().controls).toEqual(before);
    });
});

describe("the loopMIDI warning", () => {
    it("stays out of the way while the port is there", async () => {
        await setUp({ portPresent: true });

        expect(midiWarning()).toBeNull();
    });

    it("tells the user the port is missing, and goes away once they start it", async () => {
        // MidiService only learns the port exists inside requestMIDIAccess, which is the whole
        // reason the warning carries a refresh button rather than clearing itself.
        const { midi } = await setUp({ portPresent: false });
        expect(midiWarning()).toBeInTheDocument();

        midi.setPortPresent(true);
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Check for the Adaptizer MIDI port again" }));
        });

        expect(midiWarning()).toBeNull();
    });
});
