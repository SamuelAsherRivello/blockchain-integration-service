# Class Template

Use this as a language-neutral OOP ordering and contract guide. Adapt its syntax to the active language and omit sections that do not apply. Prefer a function or data type when a cohesive lifecycle, state boundary, polymorphic substitution, or injected collaboration is not needed.

```text
File: <responsibility-oriented-name>

Imports / dependencies
Public contract(s): interface, protocol, abstract type, or equivalent expectation

Class <ConcreteResponsibility> implements <PublicContract>
  Public constants and stable defaults
  Private state
  Constructor / dependency injection
  Public operations grouped by caller intent
  Protected extension points, only when a stable inheritance contract exists
  Private helpers grouped by the operation they support

Companion exports: factories, value types, errors, or test fakes when they belong here
```

## Expectations

- The file name, primary type, and public contract should communicate one responsibility.
- Expose the smallest useful public API. Keep mutable state private and explain its owner.
- Depend on contracts or stable abstractions at boundaries; inject collaborators where that improves substitution and testing.
- Favor composition over inheritance. Use inheritance only for a real, documented substitutability relationship; make overridden behavior explicit where the language supports it.
- Separate transport/UI adapters from domain/application logic. Keep framework-specific code at its boundary.
- Keep construction, validation, error behavior, and lifecycle expectations visible to callers.
- Co-locate small contracts with their single consumer/provider when that improves discoverability; promote only genuinely shared contracts.

### React and TypeScript illustration

```ts
export interface Clock {
  now(): Date;
}

export class SessionExpiryPolicy {
  private readonly clock: Clock;

  public constructor(clock: Clock) {
    this.clock = clock;
  }

  public isExpired(expiresAt: Date): boolean {
    return this.clock.now() >= expiresAt;
  }
}
```

The example illustrates an explicit contract and injected dependency; it does not imply every component needs a class.
