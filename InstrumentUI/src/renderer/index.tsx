import React from "react";
import ReactDOM from "react-dom/client";
import Project from "../shared/project";
import { MidiConnectionWarning } from "./midi-connection-warning";

const App = () => {
    const [project, setProject] = React.useState<Project | null>(null);

    React.useEffect(() => window.electronAPI.onProjectOpened(setProject), []);
    
    return <div id="main-container">
        <MidiConnectionWarning />
        <div id="project-name"><h2>{project?.name ?? "New project"}</h2></div>
        <div id="configurator">
            <div id="inputs">
                <div className="input-item">Volume</div>
                <div className="input-item selected">Intensity</div>
                <div className="input-item">Expression</div>
            </div>
            <div id="input-value">
            </div>
            <div id="outputs">
            </div>
        </div>
    </div>;
};

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);
