import { describe, expect, it } from "vitest";
import { parsePublishApiKey } from "../config";

// The publish key is read from a gitignored env at launch (ADR-0002). The file parsing is the one
// piece worth pinning: an env written the same way as the API's .dev.vars must yield the same key,
// and a file that does not carry the key must read as "no key" rather than as some other line.

describe("reading the publish key from an env file", () => {
    it("reads a quoted value written like the API's .dev.vars", () => {
        expect(parsePublishApiKey('PUBLISH_API_KEY = "s3cret-key"')).toBe("s3cret-key");
    });

    it("reads an unquoted value and ignores comments and blank lines", () => {
        const env = ["# the publish key", "", "PUBLISH_API_KEY=plain-key", ""].join("\n");
        expect(parsePublishApiKey(env)).toBe("plain-key");
    });

    it("returns null when the key is absent, so a publish fails loudly rather than with an empty key", () => {
        expect(parsePublishApiKey("SOME_OTHER_KEY=value")).toBeNull();
        expect(parsePublishApiKey("")).toBeNull();
    });

    it("treats an empty value as no key", () => {
        expect(parsePublishApiKey('PUBLISH_API_KEY = ""')).toBeNull();
        expect(parsePublishApiKey("PUBLISH_API_KEY=")).toBeNull();
    });
});
