import { app } from "electron";
import { spawn, spawnSync } from "child_process";
import { closeSync, openSync, rmSync, statSync } from "fs";
import { join } from "path";

const fileSizeCheckInterval = 2000;
const renderingStartTimeout = 5 * 60 * 1000;
// Ableton pauses writing while it loads plugins or buffers, so a short plateau is not the end of the render
const renderedFileSettleTime = 6000;
const renderingStallTimeout = 5 * 60 * 1000;

// The scripts tag the messages that are meant for the user, so the PowerShell
// error trace and the tool logs that share stderr can be left out
const scriptErrorPrefix = "ADAPTIZER_ERROR: ";

const readScriptError = (errorOutput: string, scriptName: string, exitCode: number | null): string => {
    const reportedErrors = errorOutput
        .split(/\r?\n/)
        .filter(line => line.startsWith(scriptErrorPrefix))
        .map(line => line.slice(scriptErrorPrefix.length).trim());

    return reportedErrors.join("\n")
        || errorOutput.trim()
        || `${scriptName} failed with exit code ${exitCode}.`;
};

export interface ScriptRun {
    completed: Promise<string>;
    stop: () => void;
}

const runningScripts = new Set<() => void>();

// The scripts drive Ableton and run ffmpeg, so they must not be left behind when the app goes away
export const stopRunningScripts = () => {
    runningScripts.forEach(stop => stop());
    runningScripts.clear();
};

export const runScript = (scriptName: string, args: string[]): ScriptRun => {
    const scriptPath = app.isPackaged
        ? join(process.resourcesPath, "scripts", scriptName)
        : join(__dirname, "scripts", scriptName);

    // A console window would take the foreground, and the export script sends keys to whatever window is active.
    // Nothing can answer a prompt from there either, so stdin is closed and prompts fail instead of hanging the export.
    const powershell = spawn("powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args],
        { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

    // The script starts ffmpeg and the packager, which outlive it when only it is killed.
    // Waiting for taskkill keeps the kill from being cut short when the app is quitting.
    const stop = () => {
        if (powershell.exitCode === null && powershell.pid !== undefined) {
            spawnSync("taskkill", ["/pid", powershell.pid.toString(), "/t", "/f"], { windowsHide: true });
        }
    };
    runningScripts.add(stop);

    const completed = new Promise<string>((resolve, reject) => {
        let output = "";
        let errorOutput = "";
        powershell.stdout.on("data", (data) => output += data.toString());
        powershell.stderr.on("data", (data) => errorOutput += data.toString());

        powershell.on("error", (error) => {
            runningScripts.delete(stop);
            reject(error);
        });
        powershell.on("close", (code) => {
            runningScripts.delete(stop);
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(readScriptError(errorOutput, scriptName, code)));
            }
        });
    });

    return { completed, stop };
};

export class AbletonExporter {
    async export(outputFile: string): Promise<void> {
        // A leftover file from a previous export would look like a finished render
        rmSync(outputFile, { force: true });

        await runScript("ableton-export.ps1", ["-OutputFile", outputFile]).completed;
        await this.waitForRenderedFile(outputFile);
    }

    private async waitForRenderedFile(outputFile: string): Promise<void> {
        const renderingStartDeadline = Date.now() + renderingStartTimeout;
        let previousSize = -1;
        let lastSizeChange = Date.now();

        while (true) {
            await new Promise(resolve => setTimeout(resolve, fileSizeCheckInterval));

            // Ableton creates the file before it writes anything, so an empty file is not a started render
            const size = statSync(outputFile, { throwIfNoEntry: false })?.size ?? 0;
            if (size === 0) {
                if (Date.now() > renderingStartDeadline) {
                    throw new Error(`Ableton Live did not render ${outputFile}. Please check the export settings in Ableton Live.`);
                }
                continue;
            }

            if (size !== previousSize) {
                previousSize = size;
                lastSizeChange = Date.now();
                continue;
            }

            // The file stops growing when the render is done, so it is finished once the size held
            // still for a while and Ableton closed the file
            const settledFor = Date.now() - lastSizeChange;
            if (settledFor >= renderedFileSettleTime && !this.isOpenForWriting(outputFile)) {
                return;
            }
            if (settledFor > renderingStallTimeout) {
                throw new Error(`Ableton Live stopped writing ${outputFile} before finishing the render. Please check the export settings in Ableton Live.`);
            }
        }
    }

    // Ableton keeps the rendered file open until it is done with it, which blocks opening it for writing here
    private isOpenForWriting(outputFile: string): boolean {
        try {
            closeSync(openSync(outputFile, "r+"));
            return false;
        } catch {
            return true;
        }
    }
}
