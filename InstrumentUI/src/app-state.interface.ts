import Project from "./project";

export const projectOpenedEvent: "projectOpened" = "projectOpened";

export interface IAppState {
    project: Project | null;
}