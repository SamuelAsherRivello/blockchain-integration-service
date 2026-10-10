import { useEffect, useRef, useState } from 'react';
import type { BisState } from '../state-layer-core/context';

export type ViewLoadingPolicy = Readonly<{
  isLoadingAuto: boolean;
  isLoadingModal: boolean;
  isLoadingCached: boolean;
}>;

export const defaultViewLoadingPolicy: ViewLoadingPolicy = Object.freeze({
  isLoadingAuto: true,
  isLoadingModal: false,
  isLoadingCached: true,
});

export const viewLoadingPolicies: Readonly<Record<string, ViewLoadingPolicy>> = Object.freeze({
  details: Object.freeze({ isLoadingAuto: true, isLoadingModal: false, isLoadingCached: true }),
  receive: Object.freeze({ isLoadingAuto: true, isLoadingModal: true, isLoadingCached: true }),
  send: Object.freeze({ isLoadingAuto: true, isLoadingModal: true, isLoadingCached: true }),
  transfer: Object.freeze({ isLoadingAuto: true, isLoadingModal: true, isLoadingCached: true }),
  assets: Object.freeze({ isLoadingAuto: true, isLoadingModal: true, isLoadingCached: true }),
  contracts: Object.freeze({ isLoadingAuto: true, isLoadingModal: true, isLoadingCached: true }),
  activity: Object.freeze({ isLoadingAuto: true, isLoadingModal: true, isLoadingCached: true }),
  recovery: Object.freeze({ isLoadingAuto: true, isLoadingModal: true, isLoadingCached: false }),
  onboarding: Object.freeze({ isLoadingAuto: true, isLoadingModal: false, isLoadingCached: false }),
  marketplace: Object.freeze({ isLoadingAuto: true, isLoadingModal: true, isLoadingCached: false }),
});

/** The visible account page governs every loading overlay, including host overlays. */
export function accountLoadingModalAllowed(state: BisState): boolean {
  if (state.view !== 'account' || state.phase !== 'active') return true;
  const key = state.accountOnboarding ? 'onboarding' : state.accountDetails ? 'details'
    : state.accountAssets ? 'assets' : state.accountContracts ? 'contracts'
    : state.accountActivity ? 'activity' : state.accountReceive ? 'receive'
    : state.accountSend ? 'send' : state.accountTransfer ? 'transfer'
    : state.accountRecovery ? 'recovery' : undefined;
  return (key ? viewLoadingPolicies[key] : defaultViewLoadingPolicy).isLoadingModal;
}

/**
 * Allows a newly mounted view to complete its first browser frame before its
 * entry loading dialog covers the view. The underlying read is never delayed.
 */
export function useEntryLoadingGate(loading: boolean, entryLoading: boolean, policy: ViewLoadingPolicy, viewKey = 'default') {
  const [construction, setConstruction] = useState<{key: string; ready: boolean}>({key: viewKey, ready: false});
  const initialEntry = useRef(entryLoading);
  const [entryPresentation, setEntryPresentation] = useState(entryLoading);
  useEffect(() => {
    initialEntry.current = entryLoading;
    setConstruction({key: viewKey, ready: false});
    setEntryPresentation(entryLoading);
    if (typeof window === 'undefined') {
      setConstruction({key: viewKey, ready: true});
      setEntryPresentation(false);
      return;
    }
    let hideFrame: number | undefined;
    const frame = window.requestAnimationFrame
      ? window.requestAnimationFrame(() => {
          setConstruction({key: viewKey, ready: true});
          if (entryLoading) hideFrame = window.requestAnimationFrame(() => setEntryPresentation(false));
        })
      : window.setTimeout(() => setConstruction({key: viewKey, ready: true}), 0);
    return () => {
      if (typeof frame === 'number' && window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
      if (hideFrame !== undefined && window.cancelAnimationFrame) window.cancelAnimationFrame(hideFrame);
      else window.clearTimeout(frame);
    };
  }, [viewKey, entryLoading]);
  if (!policy.isLoadingModal) return false;
  const entryPending = initialEntry.current && entryPresentation;
  if (!loading && !entryPending) return false;
  return !entryLoading || (construction.key === viewKey && construction.ready);
}
