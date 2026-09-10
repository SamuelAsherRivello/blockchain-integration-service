import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stepStates} from '../src/step-ui.js';

test('only the first incomplete onboarding step is pending',()=>{
 assert.deepEqual(
  stepStates({accountReady:true,depositSeen:false,fundingConfirmed:false,phase:'idle',commitment:undefined}),
  ['complete','pending','unstarted','unstarted','unstarted','unstarted']
 );
});

test('completed onboarding has no pending step',()=>{
 assert.deepEqual(
  stepStates({accountReady:true,depositSeen:true,fundingConfirmed:true,phase:'success',commitment:'commitment'}),
  ['complete','complete','complete','complete','complete','complete']
 );
});
