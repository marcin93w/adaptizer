import React from "react";
import ReactDOM from "react-dom/client";
import Project from "../shared/project";
import { MidiConnectionWarning } from "./midi-connection-warning/midi-connection-warning";
import Configurator from "./configurator/configurator";

const App = () => {
    const [project, setProject] = React.useState<Project>(new Project("New project"));

    React.useEffect(() => window.electronAPI.onProjectOpened(setProject), []);
    
    return <div id="main-container">
        <MidiConnectionWarning />
        <Configurator project={project} />
    </div>;
};

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);
