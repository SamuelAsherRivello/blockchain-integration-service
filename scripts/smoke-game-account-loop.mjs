// Uses a fresh profile and disposable Signet account. Never logs or saves recovery words.
// Android keyboard geometry is simulated; this does not replace a physical-device check.
const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface']});
const context=await browser.newContext({...devices['Pixel 7'],permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const button=name=>page.getByRole('button',{name,exact:true});
async function readId(){await button('Accounts Details').click();const id=await page.locator('.bis-account-id input').inputValue();await button('Back').click();return id;}
async function open(){await button('Start').click({timeout:60000});await button('Open settings').click();await button('⚡ Account').click();}
try{
 await page.goto(process.argv[2] ?? 'http://127.0.0.1:4176/');await open();
 await button('⚡ Create Account').click();
 await button('Copy Seed words').waitFor({timeout:45000});
 await button('Copy Seed words').click();
 const phrase=await page.evaluate(()=>navigator.clipboard.readText());
 assert.equal(phrase.split(' ').length,12,'created a 12-word phrase');
 await button('⚡ Continue').click();
 await button('Log Out').waitFor();
 const id=await readId();assert.ok(id);
 console.log('PASS real SDK create and Continue in game, Pixel 7 browser profile');
 await page.reload();await open();await button('Log Out').waitFor();
 assert.equal(await readId(),id);
 console.log('PASS reload retains same Account ID');
 await button('Log Out').click();
 const logout=button('Log Out');assert.equal(await logout.isEnabled(),false);
 await page.getByRole('checkbox',{name:'I have backed up my wallet',exact:true}).check();
 await logout.click();await button('Start').waitFor({timeout:60000});await open();
 await button('⚡ Restore Account').click();
 for (const size of [{width:360,height:640},{width:393,height:700},{width:412,height:915},{width:360,height:320}]){
  await page.setViewportSize(size);
  await page.getByRole('textbox',{name:'Word 12',exact:true}).count();
  const field=page.getByLabel('Word 12',{exact:true});await field.focus();await field.fill('test');await page.waitForTimeout(120);
  const geometry=await page.evaluate(()=>{const c=document.querySelector('.bis-card'),f=document.activeElement,r=c.getBoundingClientRect(),i=f.getBoundingClientRect();return {runtime:document.querySelector('.bis-runtime').getAttribute('style'),scroll:c.scrollTop,cardTop:r.top,cardBottom:r.bottom,inputTop:i.top,inputBottom:i.bottom,cardFits:r.top>=0&&r.bottom<=innerHeight+1,horizontal:document.documentElement.scrollWidth<=innerWidth,fieldVisible:i.top>=0&&i.bottom<=innerHeight,fieldInCard:i.top>=r.top&&i.bottom<=r.bottom};});
  assert.ok(geometry.cardFits&&geometry.horizontal&&geometry.fieldVisible&&geometry.fieldInCard,JSON.stringify({size,geometry}));
  console.log(`PASS Android emulation ${size.width}x${size.height}: card and focused last word reachable`);
 }
 await page.setViewportSize({width:393,height:700});
 await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:320});Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:80});visualViewport.dispatchEvent(new Event('resize'));});
 await page.getByLabel('Word 12',{exact:true}).focus();await page.waitForTimeout(150);
 const keyboard=await page.evaluate(()=>{const r=document.activeElement.getBoundingClientRect();return r.top>=80&&r.bottom<=400;});
 assert.ok(keyboard,'focused word visible with keyboard overlay and viewport pan');
 await page.evaluate(()=>{delete visualViewport.height;delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event('resize'));});
 await page.waitForTimeout(150);
 console.log('PASS simulated visualViewport keyboard overlay/pan and dismissal');
 const before=await page.locator('#coordinates-ui-pixel').textContent();
 await page.getByLabel('Word 1',{exact:true}).fill('');
 await page.getByLabel('Word 1',{exact:true}).pressSequentially('abandon ');
 assert.equal(await page.getByLabel('Word 2',{exact:true}).evaluate(el=>el===document.activeElement),true,'space advances to the next word');
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('#coordinates-ui-pixel').textContent(),before,'recovery input does not move the game');
 // Restore only this run's disposable phrase; never print or persist it in artifacts.
 await page.getByLabel('Word 1',{exact:true}).fill(phrase);
 await button('⚡ Restore').click();await button('Log Out').waitFor({timeout:45000});
 assert.equal(await readId(),id);
 await page.reload();await open();await button('Log Out').waitFor();assert.equal(await readId(),id);
 assert.deepEqual(errors,[]);
 console.log('PASS logout restarts game, restore recovers same Account ID, second reload persists; zero page errors');
} catch(e){console.error('FAIL',e.message.split('\n')[0]);console.log('Visible buttons:',await page.getByRole('button').allTextContents());console.log('Status:',await page.locator('.bis-pending-dialog p').allTextContents());process.exitCode=1;}finally{await browser.close();}
