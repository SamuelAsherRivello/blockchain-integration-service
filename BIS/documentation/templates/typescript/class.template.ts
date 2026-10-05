/**
 * Copy this template when a class is the clearest fit for the responsibility.
 * Prefer a function when there is no meaningful state or lifecycle to model.
 */
export class ExampleService {
  constructor(private readonly dependency: ExampleDependency) {}

  execute(input: ExampleInput): ExampleOutput {
    this.dependency.record(input);

    return {
      success: true,
    };
  }
}

export interface ExampleDependency {
  record(input: ExampleInput): void;
}

export interface ExampleInput {
  id: string;
}

export interface ExampleOutput {
  success: boolean;
}
