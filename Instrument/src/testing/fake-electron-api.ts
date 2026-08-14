import { ElectronApi } from "../shared/electron-api";
import { ExportResultDto, ExportSettingsDto, ProjectDto, PublishRequestDto } from "../shared/dtos";

// An in-memory stand-in for window.electronAPI, so the renderer can be driven without
// Electron and without the PowerShell/Ableton/ffmpeg chain behind it.
//
// The important piece is onExportTrackCalled: the hook fires INSIDE the call, so
// "cancel while track 3 is rendering" is expressed as a scenario rather than a timing
// hack. It is also what lets a test snapshot the MIDI log at the moment a track is
// rendered, which is how "every track carries its own control values" gets asserted.

export type ApiCall =
    | { name: "sendProjectUpdated"; project: ProjectDto }
    | { name: "selectExportFolder" }
    | { name: "selectPackager" }
    | { name: "checkExportTools"; settings: ExportSettingsDto }
    | { name: "exportTrack"; outputPath: string; trackIndex: number }
    | { name: "convertToDash"; settings: ExportSettingsDto }
    | { name: "cancelConversion" }
    | { name: "publish"; request: PublishRequestDto };

export interface ExportedTrack {
    outputPath: string;
    trackIndex: number;
}

export interface FakeElectronApi extends ElectronApi {
    /** Ordered log of every main-process call the renderer made. */
    readonly calls: readonly ApiCall[];
    readonly exportedTracks: readonly ExportedTrack[];
    readonly sentProjects: readonly ProjectDto[];
    readonly cancelConversionCount: number;
    /** Every publish the renderer asked the main process for, in order. */
    readonly publishRequests: readonly PublishRequestDto[];

    // --- drive main-process outcomes -------------------------------------------
    failCheckExportTools(message: string): void;
    failTrackExport(trackIndex: number, message: string): void;
    failConversion(message: string): void;
    /** The error the next publish returns, mirroring a missing key or a non-2xx from the Worker. */
    failPublish(message: string): void;
    /** What the user "picks" in the native dialog; null means they cancelled it. */
    setSelectedExportFolder(path: string | null): void;
    setSelectedPackager(path: string | null): void;

    /** Fires inside exportTrack, before it resolves. */
    onExportTrackCalled(hook: (trackIndex: number) => void): void;
    /** Fires inside convertToDash, before it resolves. */
    onConvertToDashCalled(hook: () => void): void;

    // --- simulate the main process pushing to the renderer ---------------------
    emitProjectOpened(project: ProjectDto): void;
    emitExportRequested(): void;
    /** Opens the Publish dialog, carrying the .adz name the main process would default. */
    emitPublishRequested(defaultName: string): void;

    /** Live listener counts - the app must not accumulate these across remounts. */
    readonly listenerCounts: { projectOpened: number; exportRequested: number; publishRequested: number };
}

const ok: ExportResultDto = { error: null };

export const createFakeElectronApi = (): FakeElectronApi => {
    const calls: ApiCall[] = [];
    const projectOpenedListeners: ((project: ProjectDto) => void)[] = [];
    const exportRequestedListeners: (() => void)[] = [];
    const publishRequestedListeners: ((defaultName: string) => void)[] = [];
    const exportTrackHooks: ((trackIndex: number) => void)[] = [];
    const convertHooks: (() => void)[] = [];

    let toolsError: string | null = null;
    let conversionError: string | null = null;
    let publishError: string | null = null;
    const trackErrors = new Map<number, string>();
    let selectedExportFolder: string | null = null;
    let selectedPackager: string | null = null;
    let cancelConversionCount = 0;
    let conversionInFlight = false;
    let conversionKilled = false;

    const record = (call: ApiCall) => calls.push(call);

    return {
        get calls() {
            return calls;
        },
        get exportedTracks(): ExportedTrack[] {
            return calls
                .filter((call): call is Extract<ApiCall, { name: "exportTrack" }> => call.name === "exportTrack")
                .map(({ outputPath, trackIndex }) => ({ outputPath, trackIndex }));
        },
        get sentProjects(): ProjectDto[] {
            return calls
                .filter((call): call is Extract<ApiCall, { name: "sendProjectUpdated" }> => call.name === "sendProjectUpdated")
                .map(call => call.project);
        },
        get cancelConversionCount() {
            return cancelConversionCount;
        },
        get publishRequests(): PublishRequestDto[] {
            return calls
                .filter((call): call is Extract<ApiCall, { name: "publish" }> => call.name === "publish")
                .map(call => call.request);
        },
        get listenerCounts() {
            return {
                projectOpened: projectOpenedListeners.length,
                exportRequested: exportRequestedListeners.length,
                publishRequested: publishRequestedListeners.length
            };
        },

        // --- the ElectronApi surface -------------------------------------------
        onProjectOpened(callback) {
            projectOpenedListeners.push(callback);
        },

        sendProjectUpdated(project: ProjectDto) {
            record({ name: "sendProjectUpdated", project });
        },

        onExportRequested(callback: () => void) {
            exportRequestedListeners.push(callback);
            return () => {
                const at = exportRequestedListeners.indexOf(callback);
                if (at >= 0) {
                    exportRequestedListeners.splice(at, 1);
                }
            };
        },

        async selectExportFolder() {
            record({ name: "selectExportFolder" });
            return selectedExportFolder;
        },

        async selectPackager() {
            record({ name: "selectPackager" });
            return selectedPackager;
        },

        async checkExportTools(settings: ExportSettingsDto) {
            record({ name: "checkExportTools", settings });
            return toolsError ? { error: toolsError } : ok;
        },

        async exportTrack(outputPath: string, trackIndex: number) {
            record({ name: "exportTrack", outputPath, trackIndex });
            exportTrackHooks.forEach(hook => hook(trackIndex));
            const error = trackErrors.get(trackIndex);
            return error ? { error } : ok;
        },

        async convertToDash(settings: ExportSettingsDto) {
            record({ name: "convertToDash", settings });
            conversionInFlight = true;
            conversionKilled = false;
            convertHooks.forEach(hook => hook());
            conversionInFlight = false;

            // Cancelling taskkills the PowerShell process, so the script exits non-zero
            // and ExportManager.run turns that into an error rather than a success
            if (conversionKilled) {
                return { error: "dash-converter.ps1 failed with exit code 1." };
            }
            return conversionError ? { error: conversionError } : ok;
        },

        async cancelConversion() {
            cancelConversionCount++;
            record({ name: "cancelConversion" });
            // With nothing running this is a no-op in the main process too
            if (conversionInFlight) {
                conversionKilled = true;
            }
        },

        onPublishRequested(callback: (defaultName: string) => void) {
            publishRequestedListeners.push(callback);
            return () => {
                const at = publishRequestedListeners.indexOf(callback);
                if (at >= 0) {
                    publishRequestedListeners.splice(at, 1);
                }
            };
        },

        async publish(request: PublishRequestDto) {
            record({ name: "publish", request });
            return publishError ? { error: publishError } : ok;
        },

        // --- drivers ------------------------------------------------------------
        failCheckExportTools(message: string) {
            toolsError = message;
        },
        failTrackExport(trackIndex: number, message: string) {
            trackErrors.set(trackIndex, message);
        },
        failConversion(message: string) {
            conversionError = message;
        },
        failPublish(message: string) {
            publishError = message;
        },
        setSelectedExportFolder(path: string | null) {
            selectedExportFolder = path;
        },
        setSelectedPackager(path: string | null) {
            selectedPackager = path;
        },
        onExportTrackCalled(hook: (trackIndex: number) => void) {
            exportTrackHooks.push(hook);
        },
        onConvertToDashCalled(hook: () => void) {
            convertHooks.push(hook);
        },
        emitProjectOpened(project: ProjectDto) {
            projectOpenedListeners.forEach(listener => listener(project));
        },
        emitExportRequested() {
            exportRequestedListeners.forEach(listener => listener());
        },
        emitPublishRequested(defaultName: string) {
            publishRequestedListeners.forEach(listener => listener(defaultName));
        }
    };
};
