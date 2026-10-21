import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENT_DISPLAY_MS, EVENT_PULSE, presentActivity } from '../src/client/events-presentation.ts';
import { EVENTS_SOURCE } from '../src/client/events-demo-source.ts';
import { monitorUrl } from '../src/client/events-popup.ts';

test('three seconds of pulses, five-second display, cancellation and reduced motion', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let animations = 0, cancelled = 0, resets = 0;
  const card = { animate(frames, options) { animations++; assert.deepEqual(frames, EVENT_PULSE.keyframes); assert.equal(options.duration * options.iterations, 3000); return { cancel() { cancelled++; } }; } } as any;
  const cancel = presentActivity(card, () => resets++, false);
  t.mock.timers.tick(3000); assert.equal(resets, 0);
  t.mock.timers.tick(1999); assert.equal(resets, 0);
  cancel();
  presentActivity(card, () => resets++, true);
  t.mock.timers.tick(EVENT_DISPLAY_MS);
  assert.equal(resets, 1); assert.equal(animations, 1); assert.equal(cancelled, 1);
});

test('popup URL captures only public configuration and source has ordered sections', () => {
  const url = new URL(monitorUrl('signet', 'public', 'http://localhost:5174/prototype-sandbox/demo-21/'));
  assert.equal(url.pathname, '/prototype-sandbox/events-monitor/');
  assert.deepEqual([...url.searchParams], [['network', 'signet'], ['address', 'public']]);
  assert.deepEqual(EVENTS_SOURCE.match(/^\/\/ (Arrange|Act|Assert)$/gm), ['// Arrange', '// Act', '// Assert']);
  assert.ok(!EVENTS_SOURCE.includes('mnemonic'));
});
