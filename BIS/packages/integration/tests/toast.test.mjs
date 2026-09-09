import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, getControls } from '../src/core/context.ts';
import { startToastPlayback } from '../src/ui/toast-playback.ts';
import {createToastQueue} from '../src/core/toasts.ts';
test('four message types retain literal text and default safely',()=>{
 const q=createToastQueue();
 for(const messageType of ['info','warning','error','success',undefined,'invalid']) {
 q.enqueue('Bitcoin Arkade ID: AbCd',{messageType});
 assert.equal(q.getSnapshot().messageType,['info','warning','error','success'].includes(messageType)?messageType:'info');
 assert.equal(q.getSnapshot().message,'Bitcoin Arkade ID: AbCd');q.complete(q.getSnapshot().id);
 }
});

function setup() {
  let walletCalls = 0;
  const unexpected = async () => { walletCalls++; throw Error('Unexpected wallet work'); };
  const context = createContext({ load: async () => ({account: null, generation: 0}), save: unexpected, reset: unexpected, subscribe: () => () => {} }, unexpected);
  return { context, queue: getControls(context).toasts, walletCalls: () => walletCalls };
}

function clock() {
  let now = 0, id = 0;
  const jobs = new Map();
  return {
    schedule(callback, delay) { const key = ++id; jobs.set(key, {at: now + delay, callback}); return () => jobs.delete(key); },
    tick(ms) {
      const target = now + ms;
      while (true) {
        const next = [...jobs.entries()].filter(([, job]) => job.at <= target).sort((a,b) => a[1].at-b[1].at)[0];
        if (!next) break;
        now = next[1].at; jobs.delete(next[0]); next[1].callback();
      }
      now = target;
    },
    pending: () => jobs.size,
  };
}

test('public toasts work before account initialization, normalize durations, and stay context-local', async () => {
  const first = setup(), second = setup();
  first.context.showToast('   ');
  assert.equal(first.queue.getSnapshot(), null);
  for (const durationMs of [undefined, NaN, Infinity, 0, -1, 2147483648]) {
    first.context.showToast('<b>Plain text</b>', {durationMs});
    const entry = first.queue.getSnapshot();
    assert.equal(entry.message, '<b>Plain text</b>');
    assert.equal(entry.durationMs, 3000);
    first.queue.complete(entry.id);
  }
  first.context.showToast('Longer', {durationMs: 5000});
  assert.equal(first.queue.getSnapshot().durationMs, 5000);
  assert.equal(second.queue.getSnapshot(), null);
  await first.context.ready();
  assert.equal(first.context.getState().view, 'empty');
  assert.equal(first.context.getState().hasProfile, false);
  assert.equal(first.walletCalls(), 0);
  first.context.dispose(); second.context.dispose();
  assert.equal(first.queue.getSnapshot(), null);
  assert.throws(() => first.context.showToast('After disposal'), /disposed/);
});

test('FIFO accepts duplicate messages and stale completion cannot skip the next entry', () => {
  const {context, queue} = setup();
  context.showToast('Same');
  const first = queue.getSnapshot();
  context.showToast('Same'); context.showToast('Third');
  assert.equal(queue.getSnapshot(), first);
  queue.complete(first.id);
  const second = queue.getSnapshot();
  assert.equal(second.message, 'Same'); assert.notEqual(second.id, first.id);
  queue.complete(first.id);
  assert.equal(queue.getSnapshot(), second);
  queue.complete(second.id);
  assert.equal(queue.getSnapshot().message, 'Third');
  context.dispose();
});

test('optional image carries the trophy asset icon independently for each message', () => {
  const {context, queue} = setup();
  const trophy = {iconUrl:'https://example.com/trophy.png'};
  context.showToast('Trophy collected.', {imageUrl:trophy.iconUrl});
  context.showToast('Text only');
  assert.equal(queue.getSnapshot().imageUrl, trophy.iconUrl);
  queue.complete(queue.getSnapshot().id);
  assert.equal(queue.getSnapshot().imageUrl, undefined);
  queue.complete(queue.getSnapshot().id);
  for(const imageUrl of ['javascript:alert(1)', 'https://user:password@example.com/icon.png', '//example.com/icon.png', '   ']) {
    context.showToast('Still readable', {imageUrl});
    assert.equal(queue.getSnapshot().imageUrl, undefined);
    queue.complete(queue.getSnapshot().id);
  }
  context.showToast('Bundled image', {imageUrl:'/assets/icon.png'});
  assert.equal(queue.getSnapshot().imageUrl, '/assets/icon.png');
  context.dispose();
});

test('pre-mount messages wait; effect replay and navigation preserve messages; unmount and disposal clear them', async () => {
  const {context, queue} = setup();
  context.showToast('Before mount'); await context.ready();
  const first = queue.getSnapshot();
  const release = queue.attachPresentation(); release();
  const releaseReplay = queue.attachPresentation();
  await Promise.resolve();
  assert.equal(queue.getSnapshot(), first);
  context.openAccountDialog(); context.closeAccount();
  assert.equal(queue.getSnapshot(), first);
  context.showToast('Queued');
  releaseReplay(); await Promise.resolve();
  assert.equal(queue.getSnapshot(), null);
  context.showToast('After unmount');
  const releaseNext = queue.attachPresentation();
  assert.equal(queue.getSnapshot().message, 'After unmount');
  releaseNext(); queue.clear();
  context.showToast('After imperative unmount');
  await Promise.resolve();
  assert.equal(queue.getSnapshot().message, 'After imperative unmount');
  context.dispose();
  assert.equal(queue.getSnapshot(), null);
});

test('entry and exit exclude the hold; arrivals in every phase do not restart the timer', () => {
  const {context, queue} = setup(), time = clock(), phases = [];
  context.showToast('First');
  const first = queue.getSnapshot();
  startToastPlayback(first.durationMs, false, phase => phases.push(phase), () => queue.complete(first.id), time.schedule);
  assert.deepEqual(phases, ['entering']);
  context.showToast('During entry'); time.tick(199); assert.equal(queue.getSnapshot(), first);
  time.tick(1); assert.deepEqual(phases, ['entering','visible']);
  context.showToast('During hold'); time.tick(2999); assert.equal(phases.at(-1), 'visible');
  time.tick(1); assert.equal(phases.at(-1), 'exiting');
  context.showToast('During exit'); time.tick(199); assert.equal(queue.getSnapshot(), first);
  time.tick(1); assert.equal(queue.getSnapshot().message, 'During entry');
  queue.complete(queue.getSnapshot().id); assert.equal(queue.getSnapshot().message, 'During hold');
  queue.complete(queue.getSnapshot().id); assert.equal(queue.getSnapshot().message, 'During exit');
  assert.equal(time.pending(), 0); context.dispose();
});

test('duration override, reduced motion, and cancellation retain correct lifetime', () => {
  const time = clock(), phases = []; let done = 0;
  const cancel = startToastPlayback(5000, true, phase => phases.push(phase), () => done++, time.schedule);
  assert.deepEqual(phases, ['visible']); time.tick(4999); assert.equal(done, 0);
  time.tick(1); assert.equal(done, 1); assert.equal(time.pending(), 0);
  cancel();
  for (const elapsed of [0, 200, 3200]) {
    const stop = startToastPlayback(3000, false, () => {}, () => done++, time.schedule);
    time.tick(elapsed); stop(); time.tick(10000);
    assert.equal(done, 1); assert.equal(time.pending(), 0);
  }
});
