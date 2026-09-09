import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('settlement failure retains its cause and callback failures are guarded',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/captureError\('settlement',error\)/);
 assert.match(source,/guardCallback\('settlement event'/);
 assert.match(source,/unhandledrejection/);
});
