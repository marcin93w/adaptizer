import { describe, expect, it, vi } from "vitest";
import { publishEndpoint, publishExport, PublishDependencies } from "../publisher";
import { Dimension, exportTrackCount, PublishRequestDto } from "../../shared/dtos";

// Publishing is the app's only network egress and the write path into the live catalog, so the
// three rules of ADR-0002 are pinned here against an injected fetch and file reader: a missing key
// makes no request, an accepted publish sends the eleven files with the bearer key, and a Worker
// rejection is surfaced rather than swallowed.

const request: PublishRequestDto = {
    folder: "C:/exports/song",
    author: "Wednesday Habits",
    album: "Demo",
    name: "My Song",
    dimension: Dimension.HEART_RATE
};

// The eleven files the export left on disk. dash-converter.ps1 writes exactly these names.
const exportFiles = [
    "manifest.mpd",
    ...Array.from({ length: exportTrackCount }, (_, variant) => `audio${variant}_dash.webm`)
];

const okResponse = () => new Response(JSON.stringify({ id: 1, name: "My Song" }), { status: 201 });

// A file reader that hands back a byte per file, so what the folder holds is not under test here
const readsEveryFile = () => vi.fn(async (path: string) => new Uint8Array([path.length]));

const setUp = (overrides: Partial<PublishDependencies> = {}) => {
    const fetch = vi.fn(async () => okResponse()) as unknown as PublishDependencies["fetch"];
    const deps: PublishDependencies = {
        apiKey: "the-key",
        fetch,
        readFile: readsEveryFile(),
        endpoint: "https://worker.test/",
        ...overrides
    };
    return { deps, fetch: deps.fetch as ReturnType<typeof vi.fn> };
};

// The multipart body handed to fetch, read back as a map of field name to its value
const sentForm = (fetch: ReturnType<typeof vi.fn>): FormData => fetch.mock.calls[0][1].body as FormData;

describe("publishing an export", () => {
    it("makes no request at all when the publish key is missing", async () => {
        const { deps, fetch } = setUp({ apiKey: null });

        const result = await publishExport(request, deps);

        expect(fetch).not.toHaveBeenCalled();
        expect(result.error).toMatch(/PUBLISH_API_KEY/);
    });

    it("sends the metadata and the eleven files to the Worker with the bearer key", async () => {
        const { deps, fetch } = setUp();

        const result = await publishExport(request, deps);

        expect(result).toEqual({ error: null });
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, init] = fetch.mock.calls[0];
        expect(url).toBe("https://worker.test/");
        expect(init.method).toBe("POST");
        expect(init.headers).toEqual({ Authorization: "Bearer the-key" });

        const form = sentForm(fetch);
        expect(form.get("author")).toBe("Wednesday Habits");
        expect(form.get("album")).toBe("Demo");
        expect(form.get("name")).toBe("My Song");
        // The dimension rides the identical-string contract, sent byte-identical from the project
        expect(form.get("dimension")).toBe("heartRate");
        // One manifest part plus ten variant parts, each a file the Worker can store
        expect(form.get("manifest.mpd")).toBeInstanceOf(Blob);
        for (let variant = 0; variant < exportTrackCount; variant++) {
            expect(form.get(`audio${variant}`)).toBeInstanceOf(Blob);
        }
    });

    it("reads exactly the eleven files the export wrote, from the chosen folder", async () => {
        const readFile = readsEveryFile();
        const { deps } = setUp({ readFile });

        await publishExport(request, deps);

        // path.join normalizes the separator per-OS, so the file names are what is asserted. Every
        // path is under the chosen folder, and it is the manifest plus audio0..9 in order.
        const readPaths = readFile.mock.calls.map(call => call[0]);
        expect(readPaths).toHaveLength(exportFiles.length);
        readPaths.forEach((path, index) => {
            expect(path).toContain("song");
            expect(path).toContain(exportFiles[index]);
        });
    });

    it("defaults to the live Worker endpoint when none is injected", async () => {
        const { deps, fetch } = setUp({ endpoint: undefined });

        await publishExport(request, deps);

        expect(fetch.mock.calls[0][0]).toBe(publishEndpoint);
    });
});

describe("when a publish cannot finish", () => {
    it("surfaces a non-2xx from the Worker, with the reason it gave", async () => {
        const fetch = vi.fn(async () =>
            new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }));
        const { deps } = setUp({ fetch: fetch as unknown as PublishDependencies["fetch"] });

        const result = await publishExport(request, deps);

        expect(result.error).toContain("401");
        expect(result.error).toContain("Unauthorized");
    });

    it("still reports the status when the Worker gave no JSON reason", async () => {
        const fetch = vi.fn(async () => new Response("<html>gateway</html>", { status: 502 }));
        const { deps } = setUp({ fetch: fetch as unknown as PublishDependencies["fetch"] });

        const result = await publishExport(request, deps);

        expect(result.error).toContain("502");
    });

    it("names the missing file when the export folder is wrong, and never calls the Worker", async () => {
        const readFile = vi.fn(async (path: string) => {
            if (path.includes("audio7")) {
                throw new Error("ENOENT: no such file");
            }
            return new Uint8Array([1]);
        });
        const { deps, fetch } = setUp({ readFile });

        const result = await publishExport(request, deps);

        expect(result.error).toContain("audio7_dash.webm");
        expect(fetch).not.toHaveBeenCalled();
    });

    it("reports a network failure rather than throwing", async () => {
        const fetch = vi.fn(async () => {
            throw new Error("getaddrinfo ENOTFOUND");
        });
        const { deps } = setUp({ fetch: fetch as unknown as PublishDependencies["fetch"] });

        const result = await publishExport(request, deps);

        expect(result.error).toContain("Could not reach the catalog");
    });
});
