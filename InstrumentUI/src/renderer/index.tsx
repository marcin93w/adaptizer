import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import Project from "./domain/project";
import { ProjectDto } from "../shared/dtos";
import { MidiConnectionWarning } from "./components/midi-connection-warning/midi-connection-warning";
import Configurator from "./components/configurator/configurator";

const App = () => {
    const [project, setProject] = React.useState<Project>(new Project());

    useEffect(() => {
        project.registerProjectUpdatedListener(() => {
            window.electronAPI.sendProjectUpdated(project.toDto());
        });
    }, [project]);

    useEffect(() => {
        window.electronAPI.onProjectOpened((projectDto: ProjectDto) => {
            const openedProject = Project.fromDto(projectDto);
            setProject(openedProject);
        });
    }, []);
    
    return <div id="main-container">
        <MidiConnectionWarning />
        <Configurator project={project} />
    </div>;
};

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);
