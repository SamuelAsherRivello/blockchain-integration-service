import { chromium } from 'playwright';
import { protectedConditionalVaultContext } from './test-wallets/conditional-vault-context.ts';
import { verifiedInventory } from './test-wallets/inventory.ts';
import { walletProfileStorageKey } from '../packages/prototype-sandbox/src/client/navigation.ts';
import type { TestNetwork } from '../packages/integration/src/client/state-layer-core/test-network.ts';

// Verify the original funded browser run after its transport-fault runner was
// interrupted. No funding or replacement transaction is permitted.
const [network,run] = process.argv.slice(2);
if (process.argv.length !== 4 || !['signet','mutinynet'].includes(network)) throw Error('vault-ack-verify-arguments');
const selected = network as TestNetwork, context = protectedConditionalVaultContext(selected);
try {
  const saved = await context.vault.transaction(async state => {
    const r = state.conditionalVaultUiAcceptance?.[run];
    if (!r || r.network !== selected || !r.descriptor || (!r.lostClaimAcknowledgement && r.faultRequested !== '--lose-claim-ack') || !r.steps.some(step => step.name === 'claim' && step.output.endsWith('Success: true'))) throw Error('vault-ack-original-claim-required');
    const claim = r.privateEntries.find(entry => entry.operation === 'claim');
    if (!claim?.transactionId || !claim.recovery.length) throw Error('vault-ack-original-signed-request-required');
    await verifiedInventory(state);
    const account = state.accounts.find(a => a.label === r.account);
    if (!account?.grant?.active || !account.grant.networks.includes(selected)) throw Error('vault-ack-account-not-authorized');
    return { descriptor: r.descriptor, transactionId: claim.transactionId, phrase: account.phrase };
  });
  const checked = await context.api.check(saved.descriptor);
  if (checked.status !== 'claimed' || checked.evidence.at(-1)?.transactionId !== saved.transactionId) throw Error('vault-ack-original-receipt-unverified');
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
  try {
    const clean = await browser.newContext();
    await clean.addInitScript(({ selected,key,phrase }) => { localStorage.setItem('network',selected);localStorage.setItem(key,phrase);localStorage.setItem('prototype-sandbox-visited','true'); }, { selected,key:walletProfileStorageKey(selected,'wallet-2-mnemonic'),phrase:saved.phrase });
    const page = await clean.newPage(); let financialPosts = 0;
    page.on('request', request => { if(request.method()==='POST' && /\/v1\/tx(?:\/|$)/.test(new URL(request.url()).pathname)) financialPosts++; });
    await page.goto(`${process.env.PROTOTYPE_SANDBOX_URL ?? 'http://127.0.0.1:5174'}/prototype-sandbox/demo-16/`,{waitUntil:'networkidle'});
    await page.locator('#vault-public-descriptor').fill(JSON.stringify(saved.descriptor));
    await page.getByRole('button',{name:'Execute',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Demo output"]')?.value.endsWith('Success: true'),null,{timeout:30000});
    const output = await page.locator('textarea[aria-label="Demo output"]').inputValue();
    if(!output.includes('Outcome: already-resolved') || financialPosts!==0)throw Error('vault-ack-repeat-claim-unverified');
    await clean.close();
    await context.vault.transaction(state=>{Object.assign(state.conditionalVaultUiAcceptance[run],{complete:true,lostClaimAcknowledgement:true,duplicateClaimNoPost:true,transportFault:'original-claim-receipt-verified-before-forwarded-response-timeout',repeatClaimOutput:output});});
    process.stdout.write(JSON.stringify({network,run,originalClaim:saved.transactionId,complete:true,lostAcknowledgementRecovered:true,repeatClaimFinancialPosts:0})+'\n');
  } finally {await browser.close();}
}catch{process.stdout.write(JSON.stringify({network,run,complete:false,reason:'vault-ack-original-verification-unavailable'})+'\n');process.exitCode=1;}
