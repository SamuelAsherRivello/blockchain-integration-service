// Isolated browser fixture over the real game modules. No wallet is created or paid.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE,args:['--enable-unsafe-webgpu']});
const url=process.argv[2] ?? 'http://127.0.0.1:5185/';
const output=new URL('../../output/playwright/',import.meta.url);await mkdir(output,{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:743,height:1321}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 // Instrument only browser responses, never the production source or package.
 await page.route(/\/src\/runtime\/main\.js(?:\?.*)?$/,async route=>{
   const response=await route.fetch(),source=await response.text();
   assert.ok(source.includes('const startGamePrompt ='));
   const hook=`globalThis.b2GameQA = {
     defeat(){getRecordsByType(SpawnerType.PLAYER)[0].combat.applyDamage(100,null);},
     freeze(){pauseController.pause('b2-inspect');},
     thaw(){pauseController.resume('b2-inspect');},
     prepare(){const p=getRecordsByType(SpawnerType.PLAYER)[0].actor.getPosition();
       getRecordsByType(SpawnerType.ENEMY).slice(0,3).forEach((r,i)=>{r.actor.setPosition({x:p.x+(i===2?256:64),y:p.y+(i===1?64:0)});r.actor.update(0);});},
     snapshot(){return {state:gameStateMachine.state,paused:pauseController.isPaused,
       actors:spawners.flatMap(s=>s.actors).map(r=>({id:r.combat.label,type:r.type,health:r.combat.health,alive:r.combat.isAlive,loadout:r.actor.getLoadout?.(),position:r.actor.getPosition(),cell:r.actor.getGridPosition(TILE_SIZE),layers:r.type===SpawnerType.PLAYER?r.actor.layers.map(l=>({visible:l.visible,opacity:l.opacity,size:Array.from(l._instanceData??[]).slice(2,4)})):undefined}))};}
   };\n`;
   await route.fulfill({response,body:source.replace('const startGamePrompt =',hook+'const startGamePrompt =')});
 });
 await page.route(/\/src\/runtime\/integration\/bis-account\.js(?:\?.*)?$/,async route=>{
   const response=await route.fetch(),source=await response.text();assert.ok(source.includes('const api = await load();'));
   await route.fulfill({response,body:source.replace('const api = await load();','const loaded = await load(); const api = globalThis.b2Fixture.wrap(loaded);')});
 });
 await page.addInitScript(()=>{
   const fixture=globalThis.b2Fixture={loggedIn:false,mode:'pending',requests:[],toasts:[],listeners:new Set(),
     setLogin(value){this.loggedIn=value;for(const listener of this.listeners)listener();},
     wrap(api){return {...api,createBisContext(){
       const context=api.createBisContext(),read=context.getState,subscribe=context.subscribe,toast=context.showToast;
       let cached,previous,previousLogin;
       context.getState=()=>{const base=read();if(previous!==base||previousLogin!==fixture.loggedIn){previous=base;previousLogin=fixture.loggedIn;cached=Object.freeze({...base,hasProfile:fixture.loggedIn,phase:fixture.loggedIn?'active':'idle',profileId:fixture.loggedIn?'b2-fixture':undefined});}return cached;};
       context.subscribe=listener=>{fixture.listeners.add(listener);const remove=subscribe(listener);return()=>{fixture.listeners.delete(listener);remove();};};
       context.showToast=(message,options)=>{fixture.toasts.push(message);toast(message,options);};
       const result=r=>({...r,profileId:'b2-fixture',status:fixture.mode,mechanism:'sink-payment',feeSats:0});
       context.requestContinue=async request=>{fixture.requests.push(request);return result(request);};
       context.getContinueStatus=async id=>{if(fixture.mode==='read-error')throw Error('fixture offline');return fixture.requests.filter(r=>r.operationId===id).map(result);};
       return context;
     }};}
   };
 });
 await page.goto(url);await page.getByRole('button',{name:'Start',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>Boolean(globalThis.b2GameQA));
 await page.keyboard.press('Digit1');await page.keyboard.press('Digit2');
 await page.evaluate(()=>b2GameQA.defeat());
 const pay=page.getByRole('button',{name:'Pay 1000 Sats To Continue',exact:true}),restart=page.getByRole('button',{name:'Restart Game',exact:true});
 await pay.waitFor();assert.equal(await pay.isDisabled(),true);assert.equal(await restart.isEnabled(),true);
 await page.screenshot({path:new URL('b2-logged-out.png',output).pathname.replace(/^\/([A-Z]:)/,'$1')});
 await page.evaluate(()=>b2Fixture.setLogin(true));assert.equal(await pay.isEnabled(),true);
 await pay.click();assert.equal(await pay.isDisabled(),true);assert.equal(await restart.isDisabled(),true);
 await page.evaluate(()=>b2Fixture.mode='read-error');await page.waitForTimeout(3300);
 assert.equal(await restart.isDisabled(),true);assert.equal(await page.evaluate(()=>b2Fixture.requests.length),1);
 await page.evaluate(()=>b2Fixture.mode='failed');await page.waitForFunction(()=>!document.querySelector('.level-lost-restart').disabled);
 assert.equal(await pay.isEnabled(),true);assert.equal(await page.evaluate(()=>b2Fixture.toasts.length),0);
 await page.evaluate(()=>{b2GameQA.prepare();b2GameQA.freeze();b2Fixture.mode='pending';});
 const before=await page.evaluate(()=>b2GameQA.snapshot());
 await pay.click();await page.evaluate(()=>b2Fixture.mode='succeeded');
 await page.waitForFunction(()=>b2GameQA.snapshot().state==='LEVEL_PLAYING');
 const after=await page.evaluate(()=>b2GameQA.snapshot());
 const playerBefore=before.actors.find(r=>r.type==='player'),playerAfter=after.actors.find(r=>r.type==='player');
 assert.ok(playerAfter);assert.notEqual(playerAfter.id,playerBefore.id);assert.equal(playerAfter.health,100);assert.deepEqual(playerAfter.position,playerBefore.position);
 assert.deepEqual(playerAfter.loadout,playerBefore.loadout);
 const nearby=before.actors.filter(r=>r.type==='enemy'&&Math.abs(r.cell.x-playerBefore.cell.x)<=1&&Math.abs(r.cell.y-playerBefore.cell.y)<=1);
 assert.ok(nearby.length>=2,'real enemies placed in cardinal and diagonal adjacent cells');
 for(const actor of before.actors.filter(r=>r.type!=='player'))assert.equal(after.actors.some(r=>r.id===actor.id),!nearby.includes(actor));
 assert.equal(after.paused,true,'independent pause survives revival');
 await page.evaluate(()=>b2GameQA.thaw());
 await page.waitForFunction(()=>b2GameQA.snapshot().actors.find(r=>r.type==='player').layers.some(layer=>layer.visible!==false&&layer.opacity===1&&Math.abs(layer.size[0])>100&&Math.abs(layer.size[1])>100));
 await page.evaluate(()=>b2GameQA.freeze());
 assert.deepEqual(await page.evaluate(()=>b2Fixture.toasts),['User paid 1000 sats to continue']);
 const toast=page.locator('.bis-toast-text');await page.locator('.bis-toast[data-phase="visible"]').waitFor();assert.equal(await toast.innerText(),'User paid 1000 sats to continue');
 const toastBounds=await toast.boundingBox();assert.ok(toastBounds.y>=0&&toastBounds.y+toastBounds.height<=1321);
 const bolt=page.locator('.bis-toast-lightning');assert.equal(await bolt.innerText(),'⚡');
 const boltBounds=await bolt.boundingBox();assert.ok(boltBounds.x+boltBounds.width<=toastBounds.x);
 assert.equal(await page.locator('.game-account-host').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 await page.screenshot({path:new URL('b2-success.png',output).pathname.replace(/^\/([A-Z]:)/,'$1')});
 const stationary=await page.evaluate(()=>b2GameQA.snapshot().actors.find(r=>r.type==='player').position);
 await page.evaluate(()=>b2GameQA.thaw());
 await page.keyboard.down('KeyW');await page.waitForTimeout(150);await page.keyboard.up('KeyW');
 const moved=await page.evaluate(()=>b2GameQA.snapshot().actors.find(r=>r.type==='player').position);
 assert.notDeepEqual(moved,stationary,'replacement player must respond to movement input');
 await page.evaluate(()=>b2GameQA.defeat());await pay.waitFor();await pay.click();
 await page.waitForFunction(()=>b2GameQA.snapshot().state==='LEVEL_PLAYING');
 assert.notEqual(await page.evaluate(()=>b2GameQA.snapshot().actors.find(r=>r.type==='player').id),playerAfter.id);
 assert.equal(await page.evaluate(()=>b2Fixture.toasts.length),2,'a second death creates exactly one new success callback/toast');
 await page.setViewportSize({width:360,height:640});await page.reload();await page.getByRole('button',{name:'Start',exact:true}).click({timeout:60000});
 assert.equal(await page.evaluate(()=>b2Fixture.requests.length),0);assert.equal(await page.evaluate(()=>b2GameQA.snapshot().state),'LEVEL_PLAYING');
 await page.evaluate(()=>b2GameQA.defeat());await pay.waitFor();
 const geometry=await pay.evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,left:r.left,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight};});
 assert.ok(geometry.left>=0&&geometry.right<=geometry.width&&geometry.top>=0&&geometry.bottom<=geometry.height,JSON.stringify(geometry));
 const fits=await page.evaluate(()=>[...document.querySelectorAll('.tiny-swords-button')].filter(button=>button.getClientRects().length).map(button=>{
   const label=button.querySelector('menu-button-label'),r=button.getBoundingClientRect(),style=getComputedStyle(button),range=document.createRange();range.selectNodeContents(label);const text=range.getBoundingClientRect();
   return {text:label.textContent,fits:text.left>=r.left+parseFloat(style.paddingLeft)-1&&text.right<=r.right-parseFloat(style.paddingRight)+1,font:parseFloat(getComputedStyle(label).fontSize),base:parseFloat(style.fontSize)};
 }));assert.ok(fits.every(item=>item.fits),JSON.stringify(fits));assert.ok(fits.some(item=>item.text.startsWith('Pay')&&item.font<item.base));
 await page.screenshot({path:new URL('b2-mobile.png',output).pathname.replace(/^\/([A-Z]:)/,'$1')});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',paymentEvidence:'isolated fixtures only; no live payment',nearbyRemoved:nearby.length,playerHealth:playerAfter.health,cases:['guest-disabled','BIS-price','pending-lock','read-error-remains-pending','failure-retry','one-toast','fresh-player-spawn','rendered-player-visible','loadout-preserved','3x3-removal','other-pause-preserved','movement-after-respawn','second-paid-respawn','reload-new-session','mobile-layout','zero-page-errors']}));
} finally {await browser.close();}
