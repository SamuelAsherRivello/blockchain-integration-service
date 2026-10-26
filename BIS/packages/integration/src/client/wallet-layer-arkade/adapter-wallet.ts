import { signingIdentity, readonlyIdentity } from './wallet-identity.ts';
import {ReadonlyWallet,Wallet,MnemonicIdentity} from '@arkade-os/sdk';
import {withTemporaryWallet,type WalletAccount} from './account.ts';
import type {RoleWalletAccess} from './adapter-session.ts';

type Options=Omit<Parameters<typeof Wallet.create>[0],'identity'>;
/** Standalone CLI invocations own a bounded temporary lifetime; browser
 * composition ALWAYS supplies a role capability. No global signer cache.
 * Borrowing grants no consent: callers still own live preflight, reservations,
 * durable checkpoints and explicit user authorization. Automatic app settlement
 * is disabled by the owner. Scoped hooks restore even on errors; retirement
 * blocks late submissions and quarantines uncertain cleanup, not local logout.
 */
export async function useReadonlyWallet<T>(account:WalletAccount,signal:AbortSignal,options:Options,use:(wallet:ReadonlyWallet)=>Promise<T>,session?:RoleWalletAccess,timeout=30000):Promise<T>{
  if(session)return session.read(account,signal,use);
  return withTemporaryWallet(ReadonlyWallet.create({...options,identity:await readonlyIdentity(account)}),signal,use,timeout);
}
export function useSigningWallet<T>(account:WalletAccount,signal:AbortSignal,options:Options,use:(wallet:Wallet)=>Promise<T>,session?:RoleWalletAccess,timeout:number|false=30000):Promise<T>{
  const deadline=timeout===false?signal:AbortSignal.any([signal,AbortSignal.timeout(timeout)]);
  if(session)return session.sign(account,deadline,options as Parameters<RoleWalletAccess['sign']>[2],use);
  return withTemporaryWallet(Wallet.create({...options,identity:signingIdentity(account)}),deadline,use,false);
}
