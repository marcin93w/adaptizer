import { app } from "electron";
import { spawn } from "child_process";
import { existsSync, rmSync, statSync } from "fs";
import { join } from "path";

const fileSizeCheckInterval = 2000;
const renderingStartTimeout = 5 * 60 * 1000;

export const runScript = (scriptName: string, args: string[]): Promise<string> => {
    const scriptPath = app.isPackaged
        ? join(process.resourcesPath, "scripts", scriptName)
        : join(__dirname, "scripts", scriptName);

    return new Promise((resolve, reject) => {
        const powershell = spawn("powershell.exe",
            ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args]);

        let output = "";
        let errorOutput = "";
        powershell.stdout.on("data", (data) => output += data.toString());
        powershell.stderr.on("data", (data) => errorOutput += data.toString());

        powershell.on("error", (error) => reject(error));
        powershell.on("close", (code) => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(errorOutput.trim() || `${scriptName} failed with exit code ${code}.`));
            }
        });
    });
};

export class AbletonExporter {
    async export(outputFile: string): Promise<void> {
        // A leftover file from a previous export would look like a finished render
        rmSync(outputFile, { force: true });

        await runScript("ableton-export.ps1", ["-OutputFile", outputFile]);
        await this.waitForRenderedFile(outputFile);
    }

    private async waitForRenderedFile(outputFile: string): Promise<void> {
        const renderingStartDeadline = Date.now() + renderingStartTimeout;
        let previousSize = -1;

        while (true) {
            await new Promise(resolve => setTimeout(resolve, fileSizeCheckInterval));

            // Ableton creates the file before it writes anything, so an empty file is not a started render
            const size = existsSync(outputFile) ? statSync(outputFile).size : 0;
            if (size === 0) {
                if (Date.now() > renderingStartDeadline) {
                    throw new Error(`Ableton Live did not render ${outputFile}. Please check the export settings in Ableton Live.`);
                }
                continue;
            }

            // The file keeps growing while Ableton renders, so it is done once the size settles
            if (size === previousSize) {
                return;
            }
            previousSize = size;
        }
    }
}
