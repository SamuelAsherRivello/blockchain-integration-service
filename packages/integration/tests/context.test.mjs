import test from 'node:test';
import assert from 'node:assert/strict';
import { createBisContext, createBisAdminContext, accountDestination, getControls } from '../src/core/context.ts';
test('account round trip, repeated open, unsubscribe and disposal', () => {
  const context = createBisContext();
  const views = [];
  const unsubscribe = context.subscribe(() => views.push(context.getState().view));
  getControls(context).present();
  context.openAccountDialog(); context.openAccountDialog(); context.closeAccount();
  assert.deepEqual(views, ['account-button', 'account', 'account-button']);
  assert.ok(Object.isFrozen(context.getState()));
  unsubscribe(); context.openAccountDialog();
  assert.equal(views.length, 3);
  context.dispose();
  assert.throws(() => context.openAccountDialog(), /disposed/);
});
test('direct opening restores empty and reset cannot resurrect disposed state', () => {
  const context = createBisContext();
  const admin = createBisAdminContext(context);
  context.openAccountDialog(); context.closeAccount();
  assert.equal(context.getState().view, 'empty');
  context.openAccountDialog(); admin.resetClient();
  assert.deepEqual(context.getState(), { view: 'empty', hasProfile: false });
  context.dispose(); assert.throws(() => admin.resetClient(), /disposed/);
});
test('profile routing is distinct without a public profile setter', () => {
  assert.equal(accountDestination(false), 'account-chooser');
  assert.equal(accountDestination(true), 'account-menu');
  assert.deepEqual(Object.keys(createBisContext()).sort(), ['closeAccount','dispose','getState','openAccountDialog','subscribe']);
});

