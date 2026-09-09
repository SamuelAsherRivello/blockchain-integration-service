import test from 'node:test';
import assert from 'node:assert/strict';
import {renderSettlementOutput} from '../src/settlement-output.js';
const container=()=>({children:['old confirmed card'],replaceChildren(){this.children=[];},append(card){this.children.push(card);}});
const card=(id,label,confirmed)=>({id,confirmed});
test('reset to a fresh account removes previous confirmed settlement cards',()=>{
 const view=container();renderSettlementOutput(view,{phase:'idle'},'new',{accountId:'old',transactions:[]},card);assert.deepEqual(view.children,[]);
});
test('late evidence from the previous account cannot populate the new account',()=>{
 const view=container();renderSettlementOutput(view,{phase:'committed',inputs:[{}],accountId:'new',commitment:'old-tx'},'new',{accountId:'old',transactions:[{txid:'old-tx',status:{confirmed:true}}]},card);assert.deepEqual(view.children,[]);
});
test('current account settlement retains its own confirmation status',()=>{
 const view=container();renderSettlementOutput(view,{phase:'committed',inputs:[{}],accountId:'new',commitment:'new-tx'},'new',{accountId:'new',transactions:[{txid:'new-tx',status:{confirmed:false}}]},card);assert.deepEqual(view.children,[{id:'new-tx',confirmed:false}]);
});
