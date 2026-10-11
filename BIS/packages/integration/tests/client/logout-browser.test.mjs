import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

test('unreadable transaction journal leaves logout checkboxes interactive without an error popup', {timeout:60000}, async t => {
  const fixture = `
    import {createContext} from '/BIS/packages/integration/src/client/state-layer-core/context.ts';
    import {createBisUi} from '/BIS/packages/integration/src/client/ui-layer-react/client.tsx';
    let account={phrase:'test-double-only',profileId:'logout-browser'},generation=0;
    const journal=new Map();
    Object.defineProperty(window,'localStorage',{configurable:true,value:{
      get length(){return journal.size;},key:i=>[...journal.keys()][i]??null,getItem:key=>journal.get(key)??null
    }});
    const context=createContext({
      load:async()=>({account,generation}),save:async()=>{},
      reset:async()=>{account=null;generation++;},subscribe:()=>()=>{}
    },async()=>{throw Error('Not used');},async()=>'logout-browser',
      undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,
      {hasGameWallet:()=>true});
    const ui=createBisUi(context);ui.mount(document.getElementById('host'));
    await context.readyAsync();ui.showAccountButton();context.openAccountDialog();
    journal.set('bis-signet-mints-v1:logout-browser','invalid-json');
    window.context=context;
  `;
  const server=await createServer({configFile:false,root:process.cwd(),cacheDir:`output/tests/logout-browser-${process.pid}`,resolve:{dedupe:['react','react-dom']},optimizeDeps:{noDiscovery:true,include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','@arkade-os/sdk','@scure/bip39','@scure/bip39/wordlists/english.js']},esbuild:{jsx:'automatic'},plugins:[{
    name:'logout-fixture',
    resolveId(id){if(id==='/logout-fixture.tsx')return id;},
    load(id){if(id==='/logout-fixture.tsx')return fixture;},
    configureServer(server){server.middlewares.use('/logout-fixture.html',(_req,res)=>{
      res.setHeader('Content-Type','text/html');
      res.end('<style>#host{position:relative;width:400px;height:800px}.bis-runtime{pointer-events:none}</style><div id="host"></div><script type="module" src="/logout-fixture.tsx"></script>');
    });},
  }],server:{host:'127.0.0.1',port:0,watch:{ignored:['**/output/**']}}});
  await server.listen();t.after(()=>server.close());
  const browser=await chromium.launch({headless:true,...(process.env.BIS_PLAYWRIGHT_CHANNEL?{channel:process.env.BIS_PLAYWRIGHT_CHANNEL}:{})});
  t.after(()=>browser.close());
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(new URL('/logout-fixture.html',server.resolvedUrls.local[0]).href);
  await page.waitForFunction(()=>!!window.context,{},{timeout:10000});
  assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:'Log Out',exact:true}).click();
  const backup=page.getByRole('checkbox',{name:'I have backed up my wallet',exact:true});
  const game=page.getByRole('checkbox',{name:'I understand the separate Game Wallet remains saved in this browser.',exact:true});
  await backup.check({timeout:3000});assert.equal(await backup.isChecked(),true);
  await game.check({timeout:3000});assert.equal(await game.isChecked(),true);
  await backup.uncheck();await backup.focus();await page.keyboard.press('Space');
  assert.equal(await backup.isChecked(),true,'keyboard toggles backup acknowledgement');
  await game.uncheck();
  await page.getByText('I understand the separate Game Wallet remains saved in this browser.',{exact:true}).click();
  assert.equal(await game.isChecked(),true,'label toggles Game Wallet acknowledgement');
  // Allow deferred operation notices enough time to surface.
  await page.waitForTimeout(1200);
  assert.equal(await page.getByRole('alertdialog').count(),0);
  assert.equal(await page.locator('[inert]').count(),0);
  assert.equal(await page.evaluate(()=>window.context.getState().error),undefined);
  await backup.uncheck();await game.uncheck();
  await page.getByRole('button',{name:'Log Out',exact:true}).click();
  await page.waitForFunction(()=>window.context.getState().hasProfile===false);
  assert.deepEqual(errors,[]);
});
