import {StepUI} from './step-ui.js';
export const layout=`
<h1 class="spike-title">Spike #1 - Arkade Onboarding</h1>
<section class="balances"><article><label>Bitcoin</label><strong id="bitcoin">—</strong><small>Onchain sats</small></article><div class="arrow">→</div><article><label>Arkade</label><strong id="arkade">—</strong><small id="available">Spendable sats: —</small></article></section>
<section class="total-duration" aria-label="Total duration of all six steps"><h2>Total duration · all 6 steps</h2><div><span>Estimated <strong id="total-estimated">Calculating…</strong></span><span>Last observed <strong id="total-observed">No completed run yet</strong></span></div><small>Account restart → Step 6 ready, including funding and confirmations.</small></section>
${StepUI({step:1,owner:'CPU',title:'Create account',estimate:'~10 seconds',
 input:'<label for="transfer-percent">% to transfer</label><div class="transfer-percentage"><input id="transfer-percent" type="range" min="1" max="100" step="1" value="50"><output id="transfer-percent-value" for="transfer-percent">50%</output></div>',
 actions:'<label class="seed-mode" for="seed-mode">Seed Phrase Creation <select id="seed-mode"><option value="auto" selected>Auto</option><option value="manual">Manual</option></select></label><button id="create" class="danger">Restart</button>',
 status:'<p id="account-status" role="status">Restoring saved account…</p><p id="recovery-feedback" role="status"></p>',
 output:'<div class="recovery-row"><label id="recovery-label" for="recovery-value">Seed phrase</label><input id="recovery-value" type="password" readonly placeholder="••••••••••••" aria-label="Account recovery secret" spellcheck="false" autocomplete="off"><button id="reveal-recovery" aria-label="Show recovery details" title="Show recovery details" aria-pressed="false" disabled><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path id="eye-slash" d="m3 3 18 18"/></svg></button><button id="copy-recovery" disabled>Copy</button></div>'})}
${StepUI({step:2,owner:'USER',title:'Fund the account',estimate:'~1–5 minutes',
 input:'<label for="address">Bitcoin boarding address</label><div class="address"><input id="address" readonly value="No account created yet"><button id="copy" disabled>Copy</button></div><span id="copied" role="status"></span>',
 actions:'<button id="faucet" class="primary" disabled>Open faucet and fund</button><a href="https://signet.2nd.dev/" target="_blank" rel="noopener noreferrer">Open faucet directly ↗</a>',
 status:'<span id="fund-status" role="status">Not started — create an account first.</span>',
 output:'<span id="fund-output">No deposit observed yet. Transaction details appear in Step 3.</span>'})}
${StepUI({step:3,owner:'CPU',title:'Wait for incoming Bitcoin',estimate:'~10–60 minutes',
 input:'<span class="muted">Bitcoin transactions sent to the boarding address in Step 2.</span>',
 actions:'<span class="muted">Automatic · checks every 5 seconds.</span>',
 status:'<p id="incoming-status" role="status">Create an account to start watching for incoming transactions.</p><small class="muted" id="incoming-checked">No transaction check completed yet.</small>',
 output:'<h3 id="incoming-count" class="transaction-count">0 incoming transactions</h3><div id="incoming-rows" class="transaction-scroll incoming-scroll" role="region" aria-label="Incoming transactions" tabindex="0"></div><a id="address-explorer" target="_blank" rel="noopener noreferrer">View address on the Signet explorer ↗</a>'})}
${StepUI({step:4,owner:'CPU',title:'Onboard 50%',estimate:'~10 seconds',
 input:'<span class="muted">Confirmed Bitcoin funds · selected percentage to Arkade, rounded down. Verified fees come from the remainder.</span>',
 actions:'<span class="muted">Automatic · starts when incoming Bitcoin is confirmed and eligible.</span>',
 status:'<p id="eligibility" role="status">Available after incoming Bitcoin is confirmed.</p>',
 output:'<span id="onboard-output">Waiting for eligible funding.</span>'})}
${StepUI({step:5,owner:'CPU',title:'Track Bitcoin → Arkade',estimate:'~10–60 minutes',
 input:'<span class="muted">The transfer authorized in Step 4.</span>',
 actions:'<span class="muted">Automatic · tracks settlement and verifies the receipt.</span><button id="diagnostic-retry" disabled>Retry preparation · no new transfer</button><button id="retry-existing" disabled>Run to completion · including recovery</button>',
 status:'<div id="status" role="status" aria-live="polite">No onboarding transfer submitted.</div><p id="error" role="alert"></p>',
 output:'<dl><dt>Target in Arkade</dt><dd id="target">—</dd><dt>Verified fee</dt><dd id="fee">—</dd><dt>Bitcoin change</dt><dd id="change">—</dd><dt>Intent ID</dt><dd id="intent">—</dd><dt>Commitment</dt><dd id="commitment">—</dd></dl>'})}
${StepUI({step:6,owner:'CPU',title:'Confirm usable Arkade funds are ready',estimate:'~5–15 seconds after settlement',id:'ready-panel',
 input:'<span class="muted">Confirmed settlement and the matching Arkade receipt.</span>',
 actions:'<span class="muted">Automatic · verifies spendable funds.</span>',
 status:'<span id="ready-status" role="status">Not started — waiting for settlement.</span>',
 output:'<p id="usable" role="status">Not ready yet. CPU will verify spendable Arkade funds after the transfer settles.</p>'})}
<div class="refresh-bar"><button id="refresh" disabled>Refresh status</button><span class="muted">Last fresh check: <span id="checked">—</span></span></div>
<footer><span id="window-label"></span> · <span id="sdk"></span> · Keep this window open during signing.</footer>`;
