import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PublishDialog } from "./publish-dialog";
import { Dimension } from "../../../shared/dtos";
import { createFakeElectronApi, FakeElectronApi } from "../../../testing/fake-electron-api";

// Publishing is the app's only network egress and the write path into the live catalog, so the
// dialog is where a producer's typo or a swallowed rejection would ship a broken song. The happy
// path is asserted end to end - what the main process is asked to publish, including the dimension
// the producer never retyped - plus the rejection that must not be swallowed.

const exportFolder = "C:/exports/my-song";

const setUp = (options: { defaultName?: string; dimension?: Dimension; dimensionLabel?: string } = {}) => {
    const api = createFakeElectronApi();
    const view = render(<PublishDialog
        defaultName={options.defaultName ?? "My Song"}
        dimension={options.dimension ?? Dimension.HEART_RATE}
        dimensionLabel={options.dimensionLabel ?? "Heart rate"}
        electronApi={api}
        onClose={() => {}} />);
    return { api, ...view };
};

const type = (label: RegExp, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

const chooseFolder = async (api: FakeElectronApi, path = exportFolder) => {
    api.setSelectedExportFolder(path);
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Browse for export folder" }));
    });
};

const clickPublish = async () => {
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^Publish/ }));
    });
};

const publishButton = () => screen.getByRole("button", { name: /^Publish/ });

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("publishing an exported song", () => {
    it("sends the metadata, the folder and the project's dimension the producer never retyped", async () => {
        const { api } = setUp({ defaultName: "My Song", dimension: Dimension.MOVEMENT_SPEED });

        // The name arrives pre-filled from the .adz; the producer fills in the rest
        expect(screen.getByLabelText(/Name/)).toHaveValue("My Song");
        type(/Author/, "Wednesday Habits");
        type(/Album/, "Demo");
        await chooseFolder(api);
        await clickPublish();

        expect(api.publishRequests).toEqual([{
            folder: exportFolder,
            author: "Wednesday Habits",
            album: "Demo",
            name: "My Song",
            // Read from the loaded project, sent byte-identical - the producer did not type it
            dimension: Dimension.MOVEMENT_SPEED
        }]);
        expect(screen.getByText(/live in the catalog/)).toHaveTextContent("My Song");
    });

    it("stays blocked until every field the Worker needs is filled", async () => {
        const { api } = setUp({ defaultName: "" });

        // Name defaulted empty (an unsaved project), so nothing to publish yet
        expect(publishButton()).toBeDisabled();
        type(/Name/, "My Song");
        expect(publishButton()).toBeDisabled();
        type(/Author/, "Wednesday Habits");
        expect(publishButton()).toBeDisabled();
        type(/Album/, "Demo");
        expect(publishButton()).toBeDisabled();
        await chooseFolder(api);
        expect(publishButton()).toBeEnabled();
    });

    it("remembers the author, album and folder for the next song, but not its name", async () => {
        const { api, unmount } = setUp({ defaultName: "First Song" });
        type(/Author/, "Wednesday Habits");
        type(/Album/, "Demo");
        await chooseFolder(api);
        await clickPublish();
        unmount();

        // A second song opens: author/album/folder carry over, the name comes from its own .adz
        setUp({ defaultName: "Second Song" });

        expect(screen.getByLabelText(/Name/)).toHaveValue("Second Song");
        expect(screen.getByLabelText(/Author/)).toHaveValue("Wednesday Habits");
        expect(screen.getByLabelText(/Album/)).toHaveValue("Demo");
        expect(screen.getByText(exportFolder)).toBeInTheDocument();
    });
});

describe("when the catalog rejects a publish", () => {
    it("shows the reason the main process gave, rather than reporting success", async () => {
        const { api } = setUp();
        // A missing key or a non-2xx both come back as result.error from the main process
        api.failPublish("Publish failed (401): Unauthorized.");
        type(/Author/, "Wednesday Habits");
        type(/Album/, "Demo");
        await chooseFolder(api);
        await clickPublish();

        expect(screen.getByText(/Publish failed \(401\): Unauthorized\./)).toBeInTheDocument();
        expect(screen.queryByText(/live in the catalog/)).toBeNull();
    });
});
