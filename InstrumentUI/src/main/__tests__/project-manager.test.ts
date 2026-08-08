import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dialog, ipcMain } from "electron";
import { ProjecManager } from "../project-manager";
import { InputType } from "../../shared/dtos";

vi.mock("electron", () => ({
    dialog: {
        showOpenDialog: vi.fn(),
        showSaveDialog: vi.fn(),
        showMessageBox: vi.fn()
    },
    ipcMain: { on: vi.fn() }
}));

const projectDto = {
    formatVersion: 2 as const,
    inputType: InputType.INTENSITY,
    controls: [{ controlNumber: 1, points: [{ input: 0, midi: 0 }, { input: 9, midi: 127 }] }]
};

describe("opening project files", () => {
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
    });

    const managerFor = () => new ProjecManager({ webContents: { send }, setTitle } as any);

    it("rejects a legacy file without replacing the current project", async () => {
        const path = join(temporaryDirectory, "legacy.adz");
        writeFileSync(path, JSON.stringify({
            inputType: "intensity",
            controls: [{ controlNumber: 1, transformType: "linear", inputMin: 0, inputMax: 9, midiMin: 0, midiMax: 127 }]
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
            detail: expect.stringContaining("format version 2")
        }));
    });

    it("normalizes and opens a valid format-2 file", async () => {
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
