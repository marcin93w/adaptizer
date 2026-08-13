import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dialog, ipcMain } from "electron";
import { ProjecManager } from "../project-manager";
import { Dimension } from "../../shared/dtos";

vi.mock("electron", () => ({
    dialog: {
        showOpenDialog: vi.fn(),
        showSaveDialog: vi.fn(),
        showMessageBox: vi.fn(),
        showErrorBox: vi.fn()
    },
    ipcMain: { on: vi.fn() }
}));

const projectDto = {
    formatVersion: 1 as const,
    dimension: Dimension.INTENSITY,
    controls: [{ controlNumber: 1, points: [{ input: 0, midi: 0 }, { input: 9, midi: 127 }] }]
};

let temporaryDirectory: string;
let send: ReturnType<typeof vi.fn>;
let setTitle: ReturnType<typeof vi.fn>;

beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "adaptizer-project-test-"));
    send = vi.fn();
    setTitle = vi.fn();
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false });
});

afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    vi.mocked(ipcMain.on).mockClear();
    vi.mocked(dialog.showErrorBox).mockClear();
});

const managerFor = () => new ProjecManager({ webContents: { send }, setTitle } as any);

describe("opening project files", () => {
    it("rejects an invalid file without replacing the current project", async () => {
        const path = join(temporaryDirectory, "invalid.adz");
        writeFileSync(path, JSON.stringify({
            formatVersion: 1,
            dimension: "intensity",
            controls: [{ controlNumber: 1, points: [{ input: 0, midi: 0 }, { input: 8, midi: 127 }] }]
        }));
        vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [path] });
        const manager = managerFor();
        manager.project = projectDto;
        manager.projectName = "Current";

        await manager.openProject();

        expect(manager.project).toEqual(projectDto);
        expect(manager.projectName).toBe("Current");
        expect(send).not.toHaveBeenCalled();
        expect(dialog.showMessageBox).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            title: "Could not open project",
            detail: expect.stringContaining("endpoints")
        }));
    });

    it("normalizes and opens a valid format-1 file", async () => {
        const path = join(temporaryDirectory, "curve.adz");
        writeFileSync(path, JSON.stringify({
            ...projectDto,
            controls: [{ controlNumber: 3, points: [{ input: 9, midi: 10 }, { input: 4, midi: 60 }, { input: 0, midi: 120 }] }]
        }));
        vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [path] });
        const manager = managerFor();

        await manager.openProject();

        expect(manager.project?.controls[0].points.map(point => point.input)).toEqual([0, 4, 9]);
        expect(send).toHaveBeenCalledWith("projectOpened", manager.project);
        expect(dialog.showMessageBox).not.toHaveBeenCalled();
    });
});

describe("saving project files", () => {
    it("writes a project that can be opened again", async () => {
        const path = join(temporaryDirectory, "saved.adz");
        vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: path });
        const manager = managerFor();
        manager.project = projectDto;

        await manager.saveProject();

        expect(JSON.parse(readFileSync(path, "utf-8"))).toEqual(projectDto);
        expect(dialog.showErrorBox).not.toHaveBeenCalled();
    });

    it("tells the user when the file could not be written", async () => {
        // The whole point of the fix: the save used to fail into console.error, so the user
        // was told nothing and went on believing their project was on disk.
        const path = join(temporaryDirectory, "no-such-folder", "saved.adz");
        vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: path });
        const manager = managerFor();
        manager.project = projectDto;

        await manager.saveProject();

        expect(dialog.showErrorBox).toHaveBeenCalledWith(
            "Could not save project",
            expect.stringContaining("not saved")
        );
    });

    it("writes nothing when the save dialog is cancelled", async () => {
        vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true, filePath: "" });
        const manager = managerFor();
        manager.project = projectDto;

        await manager.saveProject();

        expect(dialog.showErrorBox).not.toHaveBeenCalled();
    });
});
