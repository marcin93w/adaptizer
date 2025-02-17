import React from "react";
import ReactDOM from "react-dom/client";
import Project from "../shared/project";
import { MidiConnectionWarning } from "./midi-connection-warning";
import AdaptizerKnob from "./adaptizer-knob";
import { LinearControl } from "./linear-control";

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
                <AdaptizerKnob min={0} max={9} step={1} />
            </div>
            <div id="controls">
                <LinearControl isSelected={true} />
                <LinearControl isSelected={false} />
                <LinearControl isSelected={false} />
            </div>
        </div>
    </div>;
};

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);
