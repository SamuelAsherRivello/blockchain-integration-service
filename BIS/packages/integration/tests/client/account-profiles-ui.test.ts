import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

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

test('first-use confirmation is outside the screen retained for outgoing animation',async()=>{
  const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,watch:{ignored:['**/output/**']}},appType:'custom'});
  let context;
  try{
    const {BisAccountView}=await server.ssrLoadModule('/BIS/packages/integration/src/client/ui-layer-react/client.tsx');
    const {createContext,getControls}=await server.ssrLoadModule('/BIS/packages/integration/src/client/state-layer-core/context.ts');
    const phrase=generateMnemonic(wordlist);
    context=createContext(storage(),undefined,async()=> 'new-public-profile',async()=>({phrase,profileId:'new-public-profile',networkAccountFound:false}));
    await context.readyAsync();context.openRestoreAccount();
    await getControls(context).restore(phrase);
    assert.equal(context.getState().phase,'restore-confirmation');
    const html=renderToStaticMarkup(createElement(BisAccountView,{context}));
    assert.equal((html.match(/<dialog\b/g)??[]).length,1);
    assert.ok(html.indexOf('<dialog')>html.lastIndexOf('</section>'),'the native modal must not be cloned with the outgoing Account screen');
    assert.equal(html.includes(phrase),false);
  }finally{context?.dispose();await server.close();}
});

test('Account UI does not expose saved profiles while preserving ordinary account routes',async()=>{
  const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,watch:{ignored:['**/output/**']}},appType:'custom'});
  try{
    const {BisAccountView}=await server.ssrLoadModule('/BIS/packages/integration/src/client/ui-layer-react/client.tsx');
    const {createContext}=await server.ssrLoadModule('/BIS/packages/integration/src/client/state-layer-core/context.ts');
    const identify=async phrase=>phrase.endsWith('a') ? 'profile-a' : 'profile-b';
    const loggedOut=createContext(storage(),undefined,identify);
    await loggedOut.readyAsync();loggedOut.openAccountDialog();
    const loggedOutHtml=renderToStaticMarkup(createElement(BisAccountView,{context:loggedOut}));
    assert.match(loggedOutHtml,/>⚡ Create Account</);assert.match(loggedOutHtml,/>⚡ Restore Account</);assert.match(loggedOutHtml,/>Back</);
    assert.doesNotMatch(loggedOutHtml,/Profiles|profile-a|profile-b|Add Profile|Active/);
    loggedOut.dispose();

    const active=createContext(storage('profile-a'),undefined,identify);
    await active.readyAsync();active.openAccountDialog();
    const activeHtml=renderToStaticMarkup(createElement(BisAccountView,{context:active}));
    assert.match(activeHtml,/>Accounts Details</);assert.match(activeHtml,/>Log Out</);
    assert.match(activeHtml,/data-bis-player-id="profile-a"/,'only the active public identity is exposed for context verification');
    assert.doesNotMatch(activeHtml,/Profiles|profile-b|Add Profile|Active|phrase a|phrase b/);
    active.dispose();
  }finally{await server.close();}
});

test('new network account confirmation uses the exact non-secret copy',async()=>{
  const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,watch:{ignored:['**/output/**']}},appType:'custom'});
  try{
    const {ConfirmationDialog}=await server.ssrLoadModule('/BIS/packages/integration/src/client/ui-layer-react/ConfirmationDialog.tsx');
    const html=renderToStaticMarkup(createElement(ConfirmationDialog,{titleText:'Create New Account?',bodyText:'This recovery phrase does not have an account on Mutiny yet. Would you like to create one now?',confirmLabel:'Create Account',onConfirm:()=>{},onCancel:()=>{}}));
    assert.match(html,/>Create New Account\?</);assert.match(html,/This recovery phrase does not have an account on Mutiny yet\. Would you like to create one now\?/);assert.match(html,/>Create Account</);assert.match(html,/>Cancel</);
  }finally{await server.close();}
});
