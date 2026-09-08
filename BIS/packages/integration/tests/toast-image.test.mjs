import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareToastImage } from '../src/ui/toast-image.ts';

function setup() {
  const image={onload:null,onerror:null,src:'',referrerPolicy:'',decode:async()=>{}};
  let deadline, cancelled=false;
  const results=[];
  const cancel=prepareToastImage('https://example.com/trophy.png', source=>results.push(source), ()=>image, callback=>{deadline=callback;return()=>{cancelled=true;};});
  return {image,results,cancel,timeout:()=>deadline(),cancelled:()=>cancelled};
}

test('image is ready only after decoding and loads without a referrer', async()=>{
  const s=setup();
  assert.equal(s.image.referrerPolicy,'no-referrer');assert.deepEqual(s.results,[]);
  await s.image.onload();
  assert.deepEqual(s.results,['https://example.com/trophy.png']);assert.equal(s.cancelled(),true);
});

test('broken, stalled, or undecodable image falls back to text once', async()=>{
  for(const mode of ['error','timeout','decode']) {
    const s=setup();
    if(mode==='error')s.image.onerror();
    if(mode==='timeout')s.timeout();
    if(mode==='decode'){s.image.decode=async()=>{throw Error('Broken image');};await s.image.onload();}
    s.timeout();assert.deepEqual(s.results,[undefined]);assert.equal(s.cancelled(),true);
  }
});

test('unmount during image decoding ignores late completion', async()=>{
  const s=setup();let finish;
  s.image.decode=()=>new Promise(resolve=>{finish=resolve;});
  const loading=s.image.onload();s.cancel();finish();await loading;s.timeout();
  assert.deepEqual(s.results,[]);assert.equal(s.cancelled(),true);
  assert.equal(s.image.onload,null);assert.equal(s.image.onerror,null);
});
