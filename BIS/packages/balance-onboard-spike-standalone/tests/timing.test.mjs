import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyTimings,updateTiming,loadTimings,TIMING_KEY,duration} from '../src/timing.js';
test('completed durations and exact running averages are saved; unfinished runs excluded',()=>{
 let data=emptyTimings();
 data=updateTiming(data,'a',3,'start',1000);data=updateTiming(data,'a',3,'finish',11000);
 data=updateTiming(data,'b',3,'start',1000);data=updateTiming(data,'b',3,'finish',31000);
 data=updateTiming(data,'pending',3,'start',500);
 assert.deepEqual(data.averages[3],{count:2,totalMs:40000,averageMs:20000});
 const restored=loadTimings({getItem:key=>{assert.equal(key,TIMING_KEY);return JSON.stringify(data);}});
 assert.deepEqual(restored,data);
});
test('reload observations and repeated clicks do not restart or duplicate a sample',()=>{
 let data=updateTiming(emptyTimings(),'a',2,'start',1000);
 data=updateTiming(data,'a',2,'start',3000);data=updateTiming(data,'a',2,'finish',5000);
 data=updateTiming(data,'a',2,'finish',9000);
 assert.equal(data.averages[2].count,1);assert.equal(data.averages[2].averageMs,4000);
});
test('unknown historical starts and backwards clocks never manufacture completions',()=>{
 let data=updateTiming(emptyTimings(),'a',6,'finish',5000);
 assert.equal(data.averages[6].count,0);
 data=updateTiming(data,'a',6,'start',10000);data=updateTiming(data,'a',6,'finish',9000);
 assert.equal(data.averages[6].count,0);assert.equal(duration(65000),'1m 5s');
});
