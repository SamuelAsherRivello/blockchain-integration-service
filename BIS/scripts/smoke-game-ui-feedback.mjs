// Fresh profile; navigation only. Never create or restore a live wallet.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE,args:process.platform === 'linux' ? ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface'] : ['--enable-unsafe-webgpu']});
try {
 const page=await browser.newPage({viewport:{width:743,height:1321}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/\/assets\/integration-.*\.js/,async route=>{await new Promise(resolve=>setTimeout(resolve,800));await route.continue();});
 await page.goto(process.argv[2]??'http://127.0.0.1:4175/');
 await page.getByRole('button',{name:'Start',exact:true}).click({timeout:60000});
 await page.getByRole('button',{name:'Open settings',exact:true}).click();
 const first=await page.getByRole('button',{name:'⚡ Account',exact:true}).evaluate(b=>b.parentElement.firstElementChild===b);
 assert.equal(first,true);
 await page.getByRole('button',{name:'⚡ Account',exact:true}).click();
 await page.waitForTimeout(100);
 assert.equal(await page.locator('.game-account-status').isVisible(),false,'no loading placeholder');
 assert.equal(await page.locator('.game-account-status p').textContent(),'');
 await page.getByRole('button',{name:'⚡ Restore Account',exact:true}).click();
 for(const size of [{width:743,height:1321},{width:1000,height:900},{width:360,height:640},{width:393,height:700}]) {
  await page.setViewportSize(size);await page.waitForTimeout(100);
  assert.equal(await page.locator('.game-account-mount').evaluate(el=>getComputedStyle(el).transform),'none','native 100% host');
  const metrics=await page.evaluate(()=>{
   const host=document.querySelector('.game-account-host'),card=document.querySelector('.bis-card'),r=host.getBoundingClientRect(),c=card.getBoundingClientRect();
   const points=[[1,1],[innerWidth-2,innerHeight-2],[innerWidth/2,innerHeight-2],...[...document.querySelectorAll('.virtual-controller')].map(v=>{const r=v.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];})];
   return {fullscreen:r.x===0&&r.y===0&&Math.abs(r.width-innerWidth)<1&&Math.abs(r.height-innerHeight)<1,topmost:points.every(([x,y])=>x<0||y<0||x>=innerWidth||y>=innerHeight||host.contains(document.elementFromPoint(x,y))),fits:c.y>=0&&c.bottom<=innerHeight&&card.scrollHeight<=card.clientHeight+1,pageFits:document.documentElement.scrollHeight<=innerHeight,backdrop:getComputedStyle(host).backgroundColor};
  });
  assert.equal(metrics.fullscreen,true);assert.equal(metrics.topmost,true);assert.equal(metrics.fits,true);assert.equal(metrics.pageFits,true);assert.equal(metrics.backdrop,'rgba(0, 0, 0, 0.55)');
  console.log(`PASS ${size.width}x${size.height}: full-screen dark backdrop, top layer, restore fits, no page scroll`);
 }
 const captures=new URL('../../output/playwright/',import.meta.url);
 await mkdir(captures,{recursive:true});
 await page.screenshot({path:fileURLToPath(new URL('bis-game-feedback-restore.png',captures))});
 await page.getByRole('button',{name:'Back',exact:true}).click();
 await page.getByRole('button',{name:'Back',exact:true}).click();
 await page.getByText('FullScreen',{exact:true}).locator('..').locator('input').check();
 await page.getByRole('button',{name:'⚡ Account',exact:true}).click();
 await page.getByRole('button',{name:'⚡ Create Account',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.querySelector('.game-account-host').parentElement===document.fullscreenElement),true);
 await page.evaluate(()=>document.exitFullscreen());
 await page.waitForFunction(()=>document.querySelector('.game-account-host').parentElement===document.body);
 assert.equal(await page.evaluate(()=>document.querySelector('.game-account-host').parentElement===document.body),true);
 assert.equal(await page.getByRole('button',{name:'⚡ Create Account',exact:true}).isEnabled(),true);
 assert.deepEqual(errors,[]);
 console.log('PASS silent first load, Account order, fullscreen reparenting, zero page errors');
} finally {await browser.close();}
