import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('saved profile chooser shortens public IDs and visibly marks only the active profile',async()=>{
  const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
  try{
    const {AccountProfiles,shortProfileId}=await server.ssrLoadModule('/BIS/packages/integration/src/ui/AccountProfiles.tsx');
    const active='tark1activeprofileabcdefghijklmnopqrstuvwxyz';
    const other='tark1otherprofileabcdefghijklmnopqrstuvwxyz';
    const html=renderToStaticMarkup(createElement(AccountProfiles,{context:{selectProfile(){},createAccount(){},openRestoreAccount(){},closeAccount(){}},profiles:[active,other],activeProfileId:active}));
    assert.match(html,/aria-label="Saved player profiles"/);assert.equal((html.match(/aria-current="true"/g)??[]).length,1);
    assert.match(html,/>Active</);assert.match(html,/>Add Profile</);assert.match(html,/class="bis-button bis-back"[^>]*>Back</);
    assert.ok(html.includes(shortProfileId(active)));assert.ok(!html.includes(active));
  }finally{await server.close();}
});
