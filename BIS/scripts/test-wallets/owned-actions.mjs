import { fail } from './errors.mjs';

const collections = ['Assets', 'Transactions'];
export function validateOwnedAction(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request) || request.command !== 'action') fail('invalid-owned-action');
  const keys = request.type === 'select-item' ? ['command', 'type', 'screen', 'index'] : ['command', 'type', 'screen'];
  if (Object.keys(request).length !== keys.length || Object.keys(request).some(key => !keys.includes(key)) ||
      !['select-item', 'refresh'].includes(request.type) || !collections.includes(request.screen) ||
      request.type === 'select-item' && (!Number.isSafeInteger(request.index) || request.index < 0 || request.index > 999))
    fail('invalid-owned-action');
  return request;
}

// Deliberately not arbitrary selectors, evaluation, text entry or button names.
// Dynamic collection entries are outside the named scenario catalog, while
// financial controls still require their reviewed, durably journaled adapters.
export async function ownedAction(owner, request) {
  validateOwnedAction(request); // Reject private/unknown payloads before inspection.
  const before = await owner.inspect();
  if (before.mode !== 'owned' || before.screen !== request.screen || owner.loggedOut || owner.closed)
    fail('owned-action-context-mismatch');
  const { application, pair, player } = owner.registration;
  let timer;
  try {
    const activated = await Promise.race([
      owner.page.evaluate(({ application, network, playerId, gameAddress, request }) => {
        const card = [...document.querySelectorAll('.bis-card')].at(-1);
        const marker = [...document.querySelectorAll('.bis-layer[data-bis-player-id]')].at(-1);
        if (location.origin !== application.origin || location.pathname !== application.path || location.search || location.hash ||
            marker?.getAttribute('data-bis-player-id') !== playerId || marker?.getAttribute('data-bis-network') !== network ||
            marker?.getAttribute('data-bis-game-address') !== gameAddress || card?.querySelector('h2')?.textContent !== request.screen ||
            document.querySelector('[role="group"][aria-label="Private recovery phrase"]') ||
            card.querySelector('.bis-collection')?.getAttribute('aria-busy') !== 'false') return false;
        const controls = request.type === 'select-item'
          ? [...card.querySelectorAll('.bis-collection-list > li > button.bis-collection-item')]
          : [...card.querySelectorAll('button')].filter(button => button.getAttribute('aria-label') === `Refresh ${request.screen}`);
        if (request.type === 'refresh' && controls.length !== 1) return false;
        const control = controls[request.type === 'select-item' ? request.index : 0];
        if (!control || control.disabled || !control.getClientRects().length) return false;
        control.click();
        return true;
      }, { application, network: pair.network, playerId: player.profileId,
        gameAddress: owner.expected.game.arkadeAddress, request }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('bounded-action-timeout')), 5000); }),
    ]);
    if (!activated) fail('owned-action-context-mismatch');
    if (request.type === 'select-item') await owner.page.waitForFunction(screen =>
      [...document.querySelectorAll('.bis-card h2')].at(-1)?.textContent === screen,
    request.screen === 'Assets' ? 'Asset Detail' : 'Transaction Detail', { timeout: 5000 });
    return await owner.inspect();
  } catch (error) {
    // Closing cancels outstanding protocol work. Preserve profile and journals;
    // never retry an activation after an uncertain result or expose raw errors.
    await owner.close();
    if (error?.code === 'owned-action-context-mismatch') throw error;
    fail('owned-action-unavailable');
  } finally { clearTimeout(timer); }
}
