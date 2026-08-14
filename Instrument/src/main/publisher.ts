import { join } from "path";
import { exportTrackCount, PublishRequestDto, PublishResultDto } from "../shared/dtos";

// The live catalog Worker. Publishing is a POST to its root (see ADR-0002 and API/README.md);
// the same base URL the Player reads the catalog from (Player/mobile/src/config/index.ts).
export const publishEndpoint = "https://adaptizer.marcin93w.workers.dev/";

// The eleven parts of an export. `field` is the multipart name the Worker reads
// (`form.get('manifest.mpd')`, `form.get('audio0')`..); `file` is the name the export left on
// disk (dash-converter.ps1 writes `manifest.mpd` and `audioN_dash.webm`). The two differ, so the
// mapping is the publish contract between Instrument's output and the Worker's expectation.
interface ExportPart {
  field: string;
  file: string;
  contentType: string;
}

const exportParts: ExportPart[] = [
  { field: "manifest.mpd", file: "manifest.mpd", contentType: "application/dash+xml" },
  ...Array.from({ length: exportTrackCount }, (_, variant): ExportPart => ({
    field: `audio${variant}`,
    file: `audio${variant}_dash.webm`,
    contentType: "audio/webm"
  }))
];

// The main process supplies the real fetch, the real file reader and the key read at launch.
// Injected so the publish contract - no key means no request, non-2xx surfaces, the eleven files
// are sent - can be tested without a network or a folder full of audio.
export interface PublishDependencies {
  apiKey: string | null;
  fetch: typeof fetch;
  readFile: (path: string) => Promise<Uint8Array>;
  endpoint?: string;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Turns an export folder plus its metadata into one authenticated publish (ADR-0002). It reads the
 * eleven files, POSTs them as multipart/form-data with `Authorization: Bearer <key>`, and reports
 * the outcome. A missing key fails before any network request is made - the write path never opens
 * without the secret. A non-2xx from the Worker is surfaced with its body, never swallowed.
 */
export async function publishExport(
  request: PublishRequestDto,
  deps: PublishDependencies
): Promise<PublishResultDto> {
  if (!deps.apiKey) {
    return {
      error: "No publish key found. Set PUBLISH_API_KEY in Instrument/.env before publishing "
        + "(see Instrument/README.md)."
    };
  }

  const form = new FormData();
  form.set("author", request.author);
  form.set("album", request.album);
  form.set("name", request.name);
  form.set("dimension", request.dimension);

  for (const part of exportParts) {
    let bytes: Uint8Array;
    try {
      bytes = await deps.readFile(join(request.folder, part.file));
    } catch (error) {
      return {
        error: `Could not read ${part.file} from the export folder. `
          + `Publish an exported song's folder. (${errorMessage(error)})`
      };
    }
    form.set(part.field, new Blob([bytes], { type: part.contentType }), part.file);
  }

  let response: Response;
  try {
    response = await deps.fetch(deps.endpoint ?? publishEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.apiKey}` },
      body: form
    });
  } catch (error) {
    return { error: `Could not reach the catalog: ${errorMessage(error)}` };
  }

  if (!response.ok) {
    // The Worker answers a failure with a JSON `{ error }` body; fall back to the status alone if
    // it did not, so a producer always sees why rather than a bare "publish failed".
    let detail = "";
    try {
      const body = await response.json();
      detail = typeof body?.error === "string" ? body.error : "";
    } catch {
      detail = "";
    }
    return { error: `Publish failed (${response.status})${detail ? `: ${detail}` : ""}.` };
  }

  return { error: null };
}
