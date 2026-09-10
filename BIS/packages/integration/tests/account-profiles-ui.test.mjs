import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

function storage(activeProfileId) {
  const accounts = new Map([
    ['profile-a',{profileId:'profile-a',phrase:'phrase a'}],
    ['profile-b',{profileId:'profile-b',phrase:'phrase b'}],
  ]);
  return {
    async load() { return {generation:0,account:activeProfileId ? accounts.get(activeProfileId) : null}; },
    async listProfiles() { return {generation:0,profiles:[...accounts.keys()],...(activeProfileId ? {activeProfileId} : {})}; },
    async save() { throw Error('Unexpected save'); },
    async reset() { throw Error('Unexpected reset'); },
    subscribe() { return () => {}; },
  };
}

test('Account UI does not expose saved profiles while preserving ordinary account routes',async()=>{
  const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
  try{
    const {BisView}=await server.ssrLoadModule('/BIS/packages/integration/src/ui/client.tsx');
    const {createContext}=await server.ssrLoadModule('/BIS/packages/integration/src/core/context.ts');
    const identify=async phrase=>phrase.endsWith('a') ? 'profile-a' : 'profile-b';
    const loggedOut=createContext(storage(),undefined,identify);
    await loggedOut.ready();loggedOut.openAccountDialog();
    const loggedOutHtml=renderToStaticMarkup(createElement(BisView,{context:loggedOut}));
    assert.match(loggedOutHtml,/>⚡ Create Account</);assert.match(loggedOutHtml,/>⚡ Restore Account</);assert.match(loggedOutHtml,/>Back</);
    assert.doesNotMatch(loggedOutHtml,/Profiles|profile-a|profile-b|Add Profile|Active/);
    loggedOut.dispose();

    const active=createContext(storage('profile-a'),undefined,identify);
    await active.ready();active.openAccountDialog();
    const activeHtml=renderToStaticMarkup(createElement(BisView,{context:active}));
    assert.match(activeHtml,/>Accounts Details</);assert.match(activeHtml,/>Log Out</);
    assert.doesNotMatch(activeHtml,/Profiles|profile-a|profile-b|Add Profile|Active/);
    active.dispose();
  }finally{await server.close();}
});
