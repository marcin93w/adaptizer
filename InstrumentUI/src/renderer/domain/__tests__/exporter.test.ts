import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Adaptizer from "../adaptizer";
import Exporter, { ExportProgress, ExportStage } from "../exporter";
import { exportTrackCount, ExportSettingsDto } from "../../../shared/dtos";
import { createFakeElectronApi, FakeElectronApi } from "../../../testing/fake-electron-api";
import { createFakeMidiPort } from "../../../testing/fake-midi-port";
import { aControl, aProject } from "../../../testing/project-builders";

// An export renders ten tracks by walking the DAW through input values 0..9, then hands
// the WAVs to the DASH converter. It takes long enough that everything which can be
// checked up front is, and the failure it exists to prevent - ten tracks that all sound
// the same - is invisible until somebody listens to the result.

const settings: ExportSettingsDto = { outputPath: "C:/exports/song", bpm: 128, packagerPath: "" };

const setUp = (options: { portPresent?: boolean } = {}) => {
    const midi = createFakeMidiPort({ portPresent: options.portPresent ?? true });
    const api = createFakeElectronApi();
    const project = aProject({ controls: [aControl({ cc: 1 })] });
    const adaptizer = new Adaptizer(project, 0, midi);
    const progress: ExportProgress[] = [];

    return {
        midi,
        api,
        adaptizer,
        progress,
        exporter: new Exporter(adaptizer, api),
        onProgress: (update: ExportProgress) => progress.push(update)
    };
};

// Each track waits 500ms for the DAW to react to the new control values. Driving that
// virtually keeps the suite instant; advanceTimersByTimeAsync (not the sync variant) is
// required because the loop awaits IPC promises between the sleeps.
const runExport = async (exporting: Promise<void>): Promise<Error | null> => {
    const outcome = exporting.then(() => null, (error: Error) => error);
    await vi.advanceTimersByTimeAsync(exportTrackCount * 600);
    return outcome;
};

const stages = (progress: ExportProgress[]) => progress.map(update => update.stage);

const settingsSeenByMainProcess = (api: FakeElectronApi): ExportSettingsDto[] =>
    api.calls.flatMap(call => ("settings" in call ? [call.settings] : []));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("refusing to start", () => {
    it("will not export without the Adaptizer MIDI port, because every track would sound the same", async () => {
        const { api, exporter, onProgress } = setUp({ portPresent: false });

        const error = await runExport(exporter.export(settings, onProgress));

        expect(error?.message).toContain("no MIDI port named Adaptizer");
        expect(error?.message).toContain("README");
        // Nothing was asked of the main process at all - no half-started export to clean up
        expect(api.calls).toEqual([]);
    });

    it("will not export when the browser refuses MIDI access outright", async () => {
        const { midi, api, exporter, onProgress } = setUp();
        midi.failNextAccessRequest();

        const error = await runExport(exporter.export(settings, onProgress));

        expect(error?.message).toContain("no MIDI port named Adaptizer");
        expect(api.calls).toEqual([]);
    });

    it("reports missing export tools before rendering anything, not forty minutes in", async () => {
        const { api, exporter, onProgress } = setUp();
        api.failCheckExportTools("ffmpeg was not found on PATH.");

        const error = await runExport(exporter.export(settings, onProgress));

        expect(error?.message).toBe("ffmpeg was not found on PATH.");
        expect(api.exportedTracks).toEqual([]);
    });
});

describe("a complete export", () => {
    it("renders every track with its own control values", async () => {
        // The product promise. If the DAW does not actually move between tracks, all ten
        // files render identically and nothing about the export looks wrong.
        const { midi, api, exporter, onProgress } = setUp();
        const valueTheDawHeld: number[] = [];
        api.onExportTrackCalled(() => valueTheDawHeld.push(midi.lastValueFor(1)!));

        expect(await runExport(exporter.export(settings, onProgress))).toBeNull();

        expect(valueTheDawHeld).toEqual([0, 14, 28, 42, 56, 71, 85, 99, 113, 127]);
    });

    it("renders tracks 0 to 9 in order, once each, into the chosen folder", async () => {
        const { api, exporter, onProgress } = setUp();

        await runExport(exporter.export(settings, onProgress));

        expect(api.exportedTracks).toEqual(
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(trackIndex => ({
                outputPath: "C:/exports/song",
                trackIndex
            }))
        );
    });

    it("reports each track as it renders, then the conversion, then completion", async () => {
        const { exporter, progress, onProgress } = setUp();

        await runExport(exporter.export(settings, onProgress));

        expect(progress).toEqual([
            ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(trackIndex => ({
                stage: ExportStage.RENDERING,
                trackIndex,
                totalTracks: 10
            })),
            { stage: ExportStage.CONVERTING, trackIndex: 10, totalTracks: 10 },
            { stage: ExportStage.COMPLETED, trackIndex: 10, totalTracks: 10 }
        ]);
    });

    it("passes the settings the user typed to the main process unchanged", async () => {
        const { api, exporter, onProgress } = setUp();

        await runExport(exporter.export(settings, onProgress));

        // Checked up front, then used again for the conversion
        expect(settingsSeenByMainProcess(api)).toEqual([settings, settings]);
    });
});

describe("cancelling", () => {
    it("stops after the track being rendered, and is not treated as a failure", async () => {
        const { api, exporter, progress, onProgress } = setUp();
        api.onExportTrackCalled(trackIndex => {
            if (trackIndex === 2) {
                exporter.cancel();
            }
        });

        const error = await runExport(exporter.export(settings, onProgress));

        expect(error).toBeNull();
        expect(api.exportedTracks.map(track => track.trackIndex)).toEqual([0, 1, 2]);
        expect(api.calls.map(call => call.name)).not.toContain("convertToDash");
        expect(stages(progress)).not.toContain(ExportStage.COMPLETED);
    });

    it("kills the converter process when there is no step left to stop between", async () => {
        // The conversion is one long external process, so cancelling means killing it.
        // That makes the script exit non-zero, which surfaces here as an error - the
        // export dialog is what turns it into "Export cancelled." for the user.
        const { api, exporter, progress, onProgress } = setUp();
        api.onConvertToDashCalled(() => exporter.cancel());

        await runExport(exporter.export(settings, onProgress));

        expect(api.cancelConversionCount).toBe(1);
        expect(stages(progress)).not.toContain(ExportStage.COMPLETED);
    });

    it("is harmless before an export has started", async () => {
        const { api, exporter } = setUp();

        expect(() => exporter.cancel()).not.toThrow();
        expect(exporter.isCancelled).toBe(true);
        expect(api.exportedTracks).toEqual([]);
    });

    it("reports itself as cancelled so the dialog can say so", async () => {
        const { api, exporter, onProgress } = setUp();
        api.onExportTrackCalled(trackIndex => {
            if (trackIndex === 0) {
                exporter.cancel();
            }
        });

        await runExport(exporter.export(settings, onProgress));

        expect(exporter.isCancelled).toBe(true);
    });
});

describe("when something fails", () => {
    it("stops at the failing track and repeats what the DAW said, word for word", async () => {
        const { api, exporter, onProgress } = setUp();
        api.failTrackExport(4, "Ableton Live did not render 4.wav. Please check the export settings in Ableton Live.");

        const error = await runExport(exporter.export(settings, onProgress));

        expect(error?.message)
            .toBe("Ableton Live did not render 4.wav. Please check the export settings in Ableton Live.");
        expect(api.exportedTracks.map(track => track.trackIndex)).toEqual([0, 1, 2, 3, 4]);
        expect(api.calls.map(call => call.name)).not.toContain("convertToDash");
    });

    it("repeats what the converter said and does not claim the export finished", async () => {
        const { api, exporter, progress, onProgress } = setUp();
        api.failConversion("Shaka packager was not found.");

        const error = await runExport(exporter.export(settings, onProgress));

        expect(error?.message).toBe("Shaka packager was not found.");
        expect(stages(progress)).not.toContain(ExportStage.COMPLETED);
        // All ten tracks did render - only the packaging failed
        expect(api.exportedTracks).toHaveLength(exportTrackCount);
    });
});
