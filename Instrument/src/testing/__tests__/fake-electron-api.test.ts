import { describe, expect, it, vi } from "vitest";
import { createFakeElectronApi } from "../fake-electron-api";
import { ExportSettingsDto } from "../../shared/dtos";

const settings: ExportSettingsDto = { outputPath: "C:/out", bpm: 120, packagerPath: "" };

describe("the fake electron API", () => {
    it("succeeds by default, so the happy path needs no setup", async () => {
        const api = createFakeElectronApi();

        await expect(api.checkExportTools(settings)).resolves.toEqual({ error: null });
        await expect(api.exportTrack("C:/out", 0)).resolves.toEqual({ error: null });
        await expect(api.convertToDash(settings)).resolves.toEqual({ error: null });
    });

    it("fails only the track it was told to fail", async () => {
        const api = createFakeElectronApi();
        api.failTrackExport(4, "Ableton Live did not render 4.wav.");

        await expect(api.exportTrack("C:/out", 3)).resolves.toEqual({ error: null });
        await expect(api.exportTrack("C:/out", 4))
            .resolves.toEqual({ error: "Ableton Live did not render 4.wav." });
    });

    it("runs the export-track hook inside the call, before it resolves", async () => {
        // This ordering is what makes "cancel while track 3 is rendering" expressible.
        const api = createFakeElectronApi();
        const order: string[] = [];
        api.onExportTrackCalled(trackIndex => order.push(`hook:${trackIndex}`));

        await api.exportTrack("C:/out", 3).then(() => order.push("resolved"));

        expect(order).toEqual(["hook:3", "resolved"]);
    });

    it("logs the calls the renderer made, in order", async () => {
        const api = createFakeElectronApi();

        await api.checkExportTools(settings);
        await api.exportTrack("C:/out", 0);
        await api.cancelConversion();

        expect(api.calls.map(call => call.name))
            .toEqual(["checkExportTools", "exportTrack", "cancelConversion"]);
        expect(api.exportedTracks).toEqual([{ outputPath: "C:/out", trackIndex: 0 }]);
        expect(api.cancelConversionCount).toBe(1);
    });

    it("fails a conversion that was cancelled while it was running", async () => {
        // Cancelling taskkills the PowerShell process, so the script exits non-zero and
        // the main process reports an error rather than a success.
        const api = createFakeElectronApi();
        api.onConvertToDashCalled(() => void api.cancelConversion());

        const result = await api.convertToDash(settings);

        expect(result.error).toBeTruthy();
        expect(api.cancelConversionCount).toBe(1);
    });

    it("treats cancelling with nothing running as a no-op", async () => {
        const api = createFakeElectronApi();

        await api.cancelConversion();

        await expect(api.convertToDash(settings)).resolves.toEqual({ error: null });
    });

    it("pushes main-process events to whoever subscribed", () => {
        const api = createFakeElectronApi();
        const onExport = vi.fn();
        api.onExportRequested(onExport);

        api.emitExportRequested();

        expect(onExport).toHaveBeenCalledTimes(1);
    });

    it("stops delivering to a listener that unsubscribed", () => {
        // preload.ts returns an unsubscribe from onExportRequested precisely so a
        // remounting renderer does not end up with two listeners.
        const api = createFakeElectronApi();
        const onExport = vi.fn();

        const unsubscribe = api.onExportRequested(onExport);
        unsubscribe();
        api.emitExportRequested();

        expect(onExport).not.toHaveBeenCalled();
        expect(api.listenerCounts.exportRequested).toBe(0);
    });
});
