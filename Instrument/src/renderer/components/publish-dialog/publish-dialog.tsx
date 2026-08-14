import React from "react";
import { Dimension } from "../../../shared/dtos";
import { ElectronApi } from "../../../shared/electron-api";
import "./publish-dialog.scss";

interface PublishDialogProps {
    // Read from the loaded project, not retyped: the dimension travels to the catalog byte-identical
    // (the identical-string contract), and its label is shown so the producer can confirm it.
    dimension: Dimension;
    dimensionLabel: string;
    // The name the .adz was opened under, defaulting the Name field. The producer can still edit it.
    defaultName: string;
    onClose: () => void;
    electronApi?: ElectronApi;
}

// Author and album repeat across a producer's songs, and the export folder is the one just written,
// so they are remembered between publishes. The name is per-song and comes from the .adz instead.
const settingsStorageKey = "adaptizer.publishSettings";

interface StoredPublishSettings {
    author?: string;
    album?: string;
    folder?: string;
}

const readStoredSettings = (): StoredPublishSettings => {
    try {
        const stored = JSON.parse(localStorage.getItem(settingsStorageKey) ?? "{}");
        return stored !== null && typeof stored === "object" ? stored : {};
    } catch {
        return {};
    }
};

export const PublishDialog: React.FC<PublishDialogProps> = (
    { dimension, dimensionLabel, defaultName, onClose, electronApi = window.electronAPI }) => {
    const [storedSettings] = React.useState(readStoredSettings);
    const [name, setName] = React.useState<string>(defaultName);
    const [author, setAuthor] = React.useState<string>(storedSettings.author ?? "");
    const [album, setAlbum] = React.useState<string>(storedSettings.album ?? "");
    const [folder, setFolder] = React.useState<string>(storedSettings.folder ?? "");
    const [isPublishing, setIsPublishing] = React.useState(false);
    const [isPublished, setIsPublished] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Every field the Worker validates has to be present, and there is nothing to read without a folder
    const canPublish = [name, author, album, folder].every(value => value.trim() !== "");

    const selectFolder = async () => {
        const selectedPath = await electronApi.selectExportFolder();
        if (selectedPath) {
            setFolder(selectedPath);
        }
    };

    const publish = async () => {
        localStorage.setItem(settingsStorageKey, JSON.stringify({ author, album, folder }));
        setIsPublishing(true);
        setError(null);
        setIsPublished(false);

        const result = await electronApi.publish({ folder, author, album, name, dimension });

        setIsPublishing(false);
        if (result.error) {
            setError(result.error);
        } else {
            setIsPublished(true);
        }
    };

    const renderStatus = () => {
        if (isPublishing) {
            return <div className="publish-message">Publishing to the catalog...</div>;
        }
        if (error) {
            return <div className="publish-message error">{error}</div>;
        }
        if (isPublished) {
            return <div className="publish-message success">
                Published <b>{name}</b>. It is live in the catalog and streams in the Player.
            </div>;
        }
        return null;
    };

    return <div className="publish-overlay">
        <div className="publish-dialog">
            <div className="publish-title">Publish song</div>
            <div className="publish-setting">
                <label htmlFor="publish-name">Name: </label>
                <input id="publish-name" type="text" value={name} disabled={isPublishing}
                    onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="publish-setting">
                <label htmlFor="publish-author">Author: </label>
                <input id="publish-author" type="text" value={author} disabled={isPublishing}
                    onChange={(e) => setAuthor(e.target.value)} />
            </div>
            <div className="publish-setting">
                <label htmlFor="publish-album">Album: </label>
                <input id="publish-album" type="text" value={album} disabled={isPublishing}
                    onChange={(e) => setAlbum(e.target.value)} />
            </div>
            <div className="publish-setting">
                <label>Export folder: </label>
                <span className="publish-path">{folder || "No folder selected"}</span>
                <button onClick={selectFolder} disabled={isPublishing}
                    aria-label="Browse for export folder">Browse</button>
            </div>
            <div className="publish-setting">
                <label>Dimension: </label>
                <span className="publish-dimension">{dimensionLabel}</span>
            </div>
            {renderStatus()}
            <div className="publish-buttons">
                <button onClick={onClose} disabled={isPublishing}>Close</button>
                <button className="primary" onClick={publish} disabled={!canPublish || isPublishing}>
                    {isPublished || error ? "Publish again" : "Publish"}
                </button>
            </div>
        </div>
    </div>;
};
