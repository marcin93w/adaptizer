import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Adaptizer from "../../domain/adaptizer";
import { ExportDialog } from "./export-dialog";
import { exportTrackCount } from "../../../shared/dtos";
import { createFakeElectronApi, FakeElectronApi } from "../../../testing/fake-electron-api";
import { createFakeMidiPort } from "../../../testing/fake-midi-port";
import { aControl, aProject } from "../../../testing/project-builders";

// The dialog is where the export becomes a thing the user drives, and the export is the
// feature that fails silently: ten tracks that all sound the same, or a folder of WAVs
// with no manifest, both look like success until somebody listens to the result. The happy
// path is therefore asserted end to end - what the DAW was told before each track, and what
// the user is told at the end - plus the two failures the strategy singles out.

const outputFolder = "C:/exports/song";

// 10 MIDI per input step, so "track 4 was rendered at 40" reads without arithmetic
const tenPerInputStep = [{ input: 0, midi: 0 }, { input: 9, midi: 90 }];

const setUp = (options: { portPresent?: boolean } = {}) => {
    const midi = createFakeMidiPort({ portPresent: options.portPresent ?? true });
    const api = createFakeElectronApi();
    const project = aProject({ controls: [aControl({ cc: 1, points: tenPerInputStep })] });
    const view = render(
        <ExportDialog adaptizer={new Adaptizer(project, 0, midi)} electronApi={api} onClose={() => {}} />);
    return { midi, api, ...view };
};

const clickButton = async (name: string) => {
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name }));
    });
};

const chooseOutputFolder = async (api: FakeElectronApi, path = outputFolder) => {
    api.setSelectedExportFolder(path);
    await clickButton("Browse for output folder");
};

const typeBpm = (bpm: string) => fireEvent.change(screen.getByLabelText(/BPM/), { target: { value: bpm } });

// Each track gives the DAW 500ms to react to the new control values before it is rendered.
// The async variant is required: the loop awaits IPC promises between the sleeps.
const clickExportAndWait = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await act(async () => {
        await vi.advanceTimersByTimeAsync(exportTrackCount * 600);
    });
};

const exportButton = () => screen.getByRole("button", { name: "Export" });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("exporting a project", () => {
    it("walks the DAW through every track and ends with the manifest instruction", async () => {
        const { api, midi } = setUp();
        // What the DAW was holding at the moment each track was rendered. If the tracks were
        // rendered without the control values moving, every entry here would be the same.
        const valuesRendered: (number | undefined)[] = [];
        api.onExportTrackCalled(() => valuesRendered.push(midi.lastValueFor(1)));

        await chooseOutputFolder(api);
        typeBpm("128");
        await clickExportAndWait();

        expect(api.exportedTracks).toEqual(Array.from({ length: exportTrackCount },
            (_, trackIndex) => ({ outputPath: outputFolder, trackIndex })));
        expect(valuesRendered).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
        // The tempo is typed as text and reaches the converter as a number
        expect(api.calls.filter(call => call.name === "convertToDash"))
            .toEqual([{ name: "convertToDash", settings: { outputPath: outputFolder, bpm: 128, packagerPath: "" } }]);
        expect(screen.getByText(/Export complete/))
            .toHaveTextContent("Host manifest.mpd in the same directory with all .webm files.");
    });

    it("stays blocked until the settings can produce a stream", async () => {
        const { api } = setUp();

        // Nothing to write the tracks into yet
        expect(exportButton()).toBeDisabled();

        await chooseOutputFolder(api);
        expect(exportButton()).toBeEnabled();

        // dash-converter.ps1 derives its segment length from the tempo - 2 * (60 / Bpm) - and
        // refuses anything that is not above zero, forty minutes of rendering later
        typeBpm("0");
        expect(exportButton()).toBeDisabled();
        typeBpm("");
        expect(exportButton()).toBeDisabled();
        typeBpm("96");
        expect(exportButton()).toBeEnabled();
    });

    it("opens the next export on the settings the last one used", async () => {
        const { api, unmount } = setUp();
        api.setSelectedPackager("C:/tools/packager-win-x64.exe");
        await chooseOutputFolder(api);
        await clickButton("Browse for Shaka packager");
        typeBpm("96");
        await clickExportAndWait();
        unmount();

        setUp();

        expect(screen.getByLabelText(/BPM/)).toHaveValue(96);
        expect(screen.getByText(outputFolder)).toBeInTheDocument();
        expect(screen.getByText("C:/tools/packager-win-x64.exe")).toBeInTheDocument();
    });
});

// Two deliberate exceptions to happy-path-only: both of these produce a folder full of
// plausible-looking output, or a misleading message, when they regress.
describe("when the export cannot or should not finish", () => {
    it("refuses to start without the Adaptizer port, and says which port is missing", async () => {
        const { api } = setUp({ portPresent: false });

        await chooseOutputFolder(api);
        await clickExportAndWait();

        expect(screen.getByText(/no MIDI port named Adaptizer/)).toBeInTheDocument();
        expect(api.exportedTracks).toEqual([]);
    });

    it("ends a cancelled export with 'Export cancelled.', not the failure it aborts on", async () => {
        const { api } = setUp();
        api.onExportTrackCalled(trackIndex => {
            if (trackIndex === 3) {
                fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
            }
        });

        await chooseOutputFolder(api);
        await clickExportAndWait();

        expect(api.exportedTracks.map(track => track.trackIndex)).toEqual([0, 1, 2, 3]);
        expect(screen.getByText("Export cancelled.")).toBeInTheDocument();
        expect(screen.queryByText(/Export complete/)).toBeNull();
    });
});
