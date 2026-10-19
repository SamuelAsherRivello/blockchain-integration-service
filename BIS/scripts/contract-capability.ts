import { MnemonicIdentity } from '@arkade-os/sdk';
import { inspectVaultCapability } from '../packages/integration/src/client/wallet-layer-arkade/conditional-vault-capability.ts';
import { Vault } from './test-wallets/vault.ts';
import { verifiedInventory } from './test-wallets/inventory.ts';

try {
  if(process.argv.length!==3)throw Error('vault-capability-account-required');
  const vault=new Vault();
  const checks=await vault.transaction(async state=>{
    await verifiedInventory(state);
    const account=state.accounts.find(row=>row.label===process.argv[2]);
    if(!account?.grant?.active)throw Error('vault-capability-account-unavailable');
    const key=await MnemonicIdentity.fromMnemonic(account.phrase,{isMainnet:false}).xOnlyPublicKey();
    const results=[];
    for(const network of ['signet','mutinynet'] as const) {
      if(!account.grant.networks.includes(network))throw Error('vault-capability-network-not-authorized');
      try {results.push(await inspectVaultCapability(network,key));}
      catch(error){ results.push({network,classification:'unavailable',reason:error instanceof Error && /^vault-capability-[a-z-]+$/.test(error.message)?error.message:'vault-capability-provider-unavailable',fundedAcceptance:false}); }
    }
    return results;
  });
  process.stdout.write(JSON.stringify({checks})+'\n');
  if(checks.some(check=>check.classification==='unavailable'))process.exitCode=1;
}catch(error){
  const reason=error instanceof Error && /^(vault-capability-[a-z-]+|vault-[a-z-]+)$/.test(error.message)?error.message:'vault-capability-unavailable';
  process.stdout.write(JSON.stringify({success:false,reason})+'\n');process.exitCode=1;
}
