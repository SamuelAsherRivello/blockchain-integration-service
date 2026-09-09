import {test} from 'node:test';
import assert from 'node:assert/strict';
import {incomingTransactions} from '../src/incoming.js';
const txid='a'.repeat(64);
const tx={txid,vout:[{scriptpubkey_address:'own',value:'1200'},{scriptpubkey_address:'other',value:900},{scriptpubkey_address:'own',value:'300'}],status:{confirmed:false}};
test('incoming evidence includes unconfirmed receipts and sums only owned outputs with numeric SDK values',()=>{
 assert.deepEqual(incomingTransactions([tx],'own',[{txid,value:1500}]),[{txid,amount:1500,unspent:1500,confirmed:false,time:undefined}]);
});
test('confirmed spent receipts remain visible as history without claiming available funds',()=>{
 const [row]=incomingTransactions([{...tx,status:{confirmed:true,block_time:123}}],'own',[]);
 assert.equal(row.confirmed,true);assert.equal(row.unspent,0);assert.equal(row.amount,1500);
});
test('empty address history differs from malformed evidence',()=>{
 assert.deepEqual(incomingTransactions([tx],'not-own',[]),[]);
 assert.throws(()=>incomingTransactions([{...tx,vout:[{scriptpubkey_address:'own',value:'invalid'}]}],'own',[]));
});
