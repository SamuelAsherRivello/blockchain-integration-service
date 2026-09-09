import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyTimings,updateTiming,loadTimings,TIMING_KEY,duration,totalTiming} from '../src/timing.js';
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

test('total duration uses elapsed boundaries, averages complete runs, and chooses the latest completion',()=>{
 const data=emptyTimings();
 data.runs={latest:{1:{startedAt:10000},6:{finishedAt:50000}},older:{1:{startedAt:1000},6:{finishedAt:21000}},pending:{1:{startedAt:60000}},unknownStart:{6:{finishedAt:70000}},backwards:{1:{startedAt:90000},6:{finishedAt:80000}}};
 assert.deepEqual(totalTiming(data),{minMs:30000,maxMs:30000,lastMs:40000,observed:true});
});

test('total estimate falls back to six step ranges when no completed run exists',()=>{
 assert.deepEqual(totalTiming(emptyTimings()),{minMs:1285000,maxMs:7535000,lastMs:null,observed:false});
 const data=emptyTimings();data.averages[3]={count:1,averageMs:1000};
 const total=totalTiming(data);assert.equal(total.minMs,686000);assert.equal(total.maxMs,3936000);
});
