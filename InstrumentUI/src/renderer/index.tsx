import React from "react";
import ReactDOM from "react-dom/client";
import Project from "../shared/project";

const App = () => {
    const [project, setProject] = React.useState<Project | null>(null);

    React.useEffect(() => window.electronAPI.onProjectOpened(setProject), []);
    
    return <h1>{project?.name ?? "Open or create a project to get started"}</h1>;
};

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);
