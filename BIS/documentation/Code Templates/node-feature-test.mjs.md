# Node feature test

## Purpose

Prove one externally meaningful state or lifecycle rule using deterministic dependencies.

## Allowed dependencies

- `node:test`, `node:assert/strict`, the public feature entry point, and local fake dependencies.
- No live wallets, recovery material, or network calls.

## Template

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('feature ignores a result after disposal', async () => {
  const fixture = createFixture();
  const work = fixture.controller.refresh();
  fixture.controller.dispose();
  fixture.resolve(); await work;
  assert.equal(fixture.published, false);
});
```

## Verification

Name the lifecycle/receipt rule precisely. Keep fixtures local, test the failure/replay path as well as success, and run `npm test`.
