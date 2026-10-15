/**
 * Copy this template when a class is the clearest fit for the responsibility.
 * Prefer a function when there is no meaningful state or lifecycle to model.
 */
export class BisExampleService {
  constructor(private readonly dependency: IBisExampleDependency) {}

  execute(input: BisExampleInput): BisExampleOutput {
    this.dependency.record(input);

    return {
      success: true,
    };
  }
}

export interface IBisExampleDependency {
  record(input: BisExampleInput): void;
}

export type BisExampleInput = Readonly<{
  id: string;
}>;

export type BisExampleOutput = Readonly<{
  success: boolean;
}>;
