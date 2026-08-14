import { readFileSync } from "fs";
import { join } from "path";

// The single secret that gates the publish write path (ADR-0002). Read on the client from a
// gitignored env, never compiled into the packaged app.
const PUBLISH_API_KEY = "PUBLISH_API_KEY";

/**
 * Pulls PUBLISH_API_KEY out of a `.env`-style file body. One `KEY=value` per line, `#` comments
 * and blank lines ignored, optional surrounding quotes stripped so the value can be written the
 * same way as the API's `.dev.vars` (`PUBLISH_API_KEY = "..."`). Returns null when the key is
 * absent or empty, which the caller turns into a clear "no key" error before any request.
 */
export function parsePublishApiKey(envFileContents: string): string | null {
  for (const rawLine of envFileContents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }
    if (line.slice(0, separator).trim() !== PUBLISH_API_KEY) {
      continue;
    }
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    return value === "" ? null : value;
  }
  return null;
}

/**
 * Reads the publish key at launch. An explicit `PUBLISH_API_KEY` in the environment wins, so the
 * app can be started with the key set in the shell; otherwise it is read from a gitignored `.env`
 * beside the app root, off disk at runtime rather than from anything bundled. A missing file is
 * not an error here - it becomes the "no key" message the moment a publish is attempted.
 */
export function readPublishApiKey(): string | null {
  const fromEnvironment = process.env[PUBLISH_API_KEY]?.trim();
  if (fromEnvironment) {
    return fromEnvironment;
  }
  try {
    // Compiled main lives in dist/main, so the app root is two levels up.
    return parsePublishApiKey(readFileSync(join(__dirname, "../../.env"), "utf-8"));
  } catch {
    return null;
  }
}
