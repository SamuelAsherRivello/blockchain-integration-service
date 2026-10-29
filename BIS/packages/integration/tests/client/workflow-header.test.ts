import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

test('shared header identifies selected Local/Server mode separately from health and keeps network/version',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
  const {AccountDialogShell}=await server.ssrLoadModule('/BIS/packages/integration/src/client/ui-layer-react/AccountCard.tsx');
  for(const fixture of [
   {workflowMode:'local',network:'Mutinynet',serverHealth:'absent',label:'Local',health:undefined},
   {workflowMode:'server',network:'Signet',serverHealth:'connecting',label:'Server',health:'Connecting'},
   {workflowMode:'server',network:'Signet',serverHealth:'unavailable',label:'Server',health:'Unavailable'},
   {workflowMode:'server',network:'Signet',serverHealth:'connected',label:'Server',health:'Connected'},
  ]){
   const markup=renderToStaticMarkup(createElement(AccountDialogShell,{title:'Account',description:null,headingRef:null,...fixture}));
   assert.match(markup,new RegExp('class="bis-workflow-label">'+fixture.label+'</span>'));
   assert.ok(markup.indexOf('bis-workflow-label')<markup.indexOf('bis-network-text'));
   assert.ok(markup.includes('Network: '+fixture.network));assert.match(markup,/BIS: v\d+\.\d+\.\d+/);
   if(fixture.health)assert.ok(markup.includes('Server connection: '+fixture.health));else assert.equal(markup.includes('Server connection:'),false);
   assert.equal(markup.includes('Direct'),false);assert.equal(markup.includes('Use Server'),false);assert.equal(markup.includes('Use Local'),false);
  }
  const pending=renderToStaticMarkup(createElement(AccountDialogShell,{title:'Account',description:null,headingRef:null,network:'Choose'}));
  assert.equal(pending.includes('bis-workflow-label'),false);
 }finally{await server.close();}
});
