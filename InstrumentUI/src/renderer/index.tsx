import React from "react";
import ReactDOM from "react-dom/client";
import Project, { ProjectDto } from "../shared/project";
import { MidiConnectionWarning } from "./midi-connection-warning/midi-connection-warning";
import Configurator from "./configurator/configurator";

const App = () => {
    const [project, setProject] = React.useState<Project>(new Project());

    const setupUpdateListener = (p: Project) => {
        p.registerProjectUpdatedListener(() => {
            window.electronAPI.sendProjectUpdated(p.toDto());
        });
    }

    setupUpdateListener(project);
    window.electronAPI.onProjectOpened((projectDto: ProjectDto) => {
        const openedProject = Project.fromDto(projectDto);
        setupUpdateListener(openedProject);
        setProject(openedProject);
    });
    
    return <div id="main-container">
        <MidiConnectionWarning />
        <Configurator project={project} />
    </div>;
};

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);
