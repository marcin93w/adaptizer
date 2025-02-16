class Project {
  constructor(public name: string) {}

  toJson() {
    return {
      test: "test",
    };
  }
}

export default Project;
