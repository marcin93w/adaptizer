import React, { useEffect } from "react";
import Project from "./domain/project";
import { ProjectDto } from "../shared/dtos";
import { ElectronApi } from "../shared/electron-api";
import { MidiPort } from "./services/midi-port";
import MidiService from "./services/midi-service";
import { MidiConnectionWarning } from "./components/midi-connection-warning/midi-connection-warning";
import Configurator from "./components/configurator/configurator";

interface AppProps {
    // Both boundaries enter the tree here and are handed down, so the whole app can be rendered
    // against fakes. index.tsx passes neither; the defaults are the real service and the bridge.
    midiPort?: MidiPort;
    electronApi?: ElectronApi;
}

// Exported and free of any mounting, so it can be rendered by a test. index.tsx is the only
// module that touches the DOM root, and importing this one has no side effects.
export const App: React.FC<AppProps> = ({ midiPort = MidiService, electronApi = window.electronAPI }) => {
    const [project, setProject] = React.useState<Project>(() => Project.newDefault());

    useEffect(() => {
        project.registerProjectUpdatedListener(() => {
            electronApi.sendProjectUpdated(project.toDto());
        });
    }, [project, electronApi]);

    useEffect(() => {
        electronApi.onProjectOpened((projectDto: ProjectDto) => {
            const openedProject = Project.fromDto(projectDto);
            setProject(openedProject);
        });
    }, [electronApi]);

    return <div id="main-container">
        <MidiConnectionWarning midiPort={midiPort} />
        <Configurator project={project} midiPort={midiPort} electronApi={electronApi} />
    </div>;
};
