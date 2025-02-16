(window as any).electronAPI.onProjectOpened((project) => {
  document.getElementById("project-name")!.textContent = project.name;
})
