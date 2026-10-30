
//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import {
  demoGetInput,
  demoSetInput,
  demoResult,
  demoErrorMessage,
  demoWithFreshWallet,
  demoGetMnemonic,
  DemoMintAssetError,
  LEVEL_ONE_ICON,
  LEVEL_ONE_TITLE,
  demoEncodeHex,
  type DemoContext,
  type TestNetwork,
} from '../sandbox-shared.ts';
import { MnemonicIdentity, type Wallet } from '@arkade-os/sdk';

type MintWallet = Pick<Wallet, 'identity' | 'restore' | 'getContractManager' | 'indexerProvider' | 'assetManager'>;
const ARKADE_ASSET_ID = /^[a-f0-9]{68}$/;
const PAGE_SIZE = 100;
// The indexer returns metadata values as UTF-8 hex. Also accept decoded providers.
// Compare to the expected encoding instead of interpreting a numeric AssetID as hex.
function matches(value: unknown, expected: string) {
  return value === expected || value === demoEncodeHex(new TextEncoder().encode(expected));
}
function historyFailureKind(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/Failed to fetch vtxos:\s*(.+)/i.test(message))
    return `indexer returned an HTTP error (${message.match(/Failed to fetch vtxos:\s*(.+)/i)?.[1] ?? 'unknown status'})`;
  if (/provider unavailable|failed to fetch|networkerror|load failed|timeout/i.test(message))
    return 'indexer request failed (network, CORS, or timeout)';
  if (/Invalid vtxos data received/i.test(message))
    return 'indexer returned an invalid history response';
  if (/pagination|truncated history/i.test(message))
    return 'indexer returned incomplete pagination data';
  if (/history output|output assets|history asset ID/i.test(message))
    return 'indexer returned an invalid history output';
  return 'indexer history request or response validation failed';
}
/** Network-backed preflight. Never use the saved AssetID-to-Arkade-ID mapping. */
export async function demoMintAsset(wallet: MintWallet, network: TestNetwork, assetID: string) {
  if (!['signet', 'mutinynet'].includes(network) || !/^000[0-9]$/.test(assetID)) {
    throw new Error('Choose a network and AssetID from the demo inputs.');
  }
  let issuer: string;
  let mintKey: string;
  let duplicate: string | undefined;
  let checkStage = 'wallet identity';
  let historyFailure: string | undefined;
  try {
    issuer = demoEncodeHex(await wallet.identity.xOnlyPublicKey());
    if (!/^[a-f0-9]{64}$/.test(issuer))
      throw new Error('Invalid wallet public key.');
    mintKey = `prototype-sword:${issuer}:${network}:${assetID}`;
    // Reconstruct used HD addresses from network history, even on a fresh browser.
    // restore rejects a truncated or failed discovery scan. The SDK gap limit is 20.
    checkStage = 'wallet address discovery';
    await wallet.restore({ gapLimit: 20 });
    checkStage = 'wallet script discovery';
    const contracts = await (await wallet.getContractManager()).getContracts();
    const scripts = [...new Set(contracts.map(contract => contract.script))];
    if (!scripts.length || scripts.some(script => !/^5120[a-f0-9]{64}$/.test(script))) {
      throw new Error('Incomplete wallet script discovery.');
    }
    const genesisAssets = new Set<string>();
    // Chunk scripts to keep URLs bounded. No spendability or timestamp filters:
    // spent, burned, expired and transferred-away genesis outputs still matter.
    for (let offset = 0; offset < scripts.length; offset += 20) {
      const chunk = scripts.slice(offset, offset + 20);
      let pageIndex = 0;
      for (;;) {
        checkStage = `network history page ${pageIndex + 1} request`;
        let response;
        try {
          response = await wallet.indexerProvider.getVtxos({ scripts: chunk, pageIndex, pageSize: PAGE_SIZE });
        }
        catch (error) {
          historyFailure = historyFailureKind(error);
          throw error;
        }
        checkStage = `network history page ${pageIndex + 1} response shape`;
        if (!Array.isArray(response.vtxos))
          throw new Error('Missing history outputs.');
        checkStage = `network history page ${pageIndex + 1} output validation`;
        for (const vtxo of response.vtxos) {
          if (!chunk.includes(vtxo.script) || !/^[a-f0-9]{64}$/.test(vtxo.txid))
            throw new Error('Invalid history output.');
          if (vtxo.assets !== undefined && !Array.isArray(vtxo.assets))
            throw new Error('Invalid output assets.');
          for (const asset of vtxo.assets ?? []) {
            if (!ARKADE_ASSET_ID.test(asset.assetId))
              throw new Error('Invalid history asset ID.');
            const isGenesis = asset.assetId.slice(0, 64) === vtxo.txid;
            // Only an asset's genesis output can prove that this issuer minted
            // it. Unrelated assets received from other wallets must not make a
            // missing metadata record block this wallet's mint preflight.
            if (isGenesis) genesisAssets.add(asset.assetId);
          }
        }
        checkStage = `network history page ${pageIndex + 1} pagination validation`;
        const page = response.page;
        // An explicit paged request must supply a usable completion signal.
        if (!page || ![page.current, page.next, page.total].every(value => Number.isSafeInteger(value) && value >= 0)
          || page.current !== Math.max(1, pageIndex)
          || (page.total === 0 ? response.vtxos.length !== 0 : page.current > page.total))
          throw new Error('Incomplete history pagination.');
        if (page.current >= page.total) {
          if (page.next !== 0 && page.next !== page.current)
            throw new Error('Inconsistent history pagination.');
          break;
        }
        // The indexer treats request indexes 0 and 1 as page 1; subsequent
        // requests use the one-based `next` value returned by the indexer.
        if (page.next !== page.current + 1 || response.vtxos.length === 0)
          throw new Error('Truncated history.');
        pageIndex = page.next;
      }
    }
    for (const assetId of genesisAssets) {
      checkStage = `metadata lookup for genesis asset ${assetId}`;
      const details = await wallet.assetManager.getAssetDetails(assetId);
      if (!details || details.assetId !== assetId)
        throw new Error('Invalid asset details.');
      const metadata = details.metadata;
      if (metadata !== undefined && (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))) {
        throw new Error('Invalid asset metadata.');
      }
      if (!metadata)
        continue;
      const sameIdentity = matches(metadata.prototypeMintKey, mintKey);
      // Older mints have no identity marker. A genesis output at one of this
      // wallet's scripts proves it received the original sword issuance.
      const legacy = metadata.prototypeMintKey === undefined
        && matches(metadata.ticker, assetID) && matches(metadata.name, LEVEL_ONE_TITLE)
        && matches(metadata.upgradePath, 'sword') && matches(metadata.level, '1');
      if (sameIdentity || legacy) {
        duplicate = assetId;
        break;
      }
    }
  }
  catch (error) {
    const detail = historyFailure ? ` (${historyFailure})` : '';
    throw new DemoMintAssetError(`Unable to verify whether AssetID ${assetID} exists during ${checkStage}${detail}. No mint was submitted. Retry the network-history check.`);
  }
  if (duplicate) {
    throw new DemoMintAssetError(`AssetID ${assetID} already exists for this wallet on ${network}. No mint was submitted.`, duplicate);
  }
  // This is a preflight check, not an atomic reservation across devices.
  const result = await wallet.assetManager.issue({ amount: 1n, metadata: {
      ticker: assetID, name: LEVEL_ONE_TITLE, title: LEVEL_ONE_TITLE, level: '1',
      icon: LEVEL_ONE_ICON, upgradeable: 'true', upgradePath: 'sword', nextLevel: '2',
      prototypeAssetID: assetID, prototypeIssuer: issuer, prototypeNetwork: network, prototypeMintKey: mintKey,
    } });
  try {
    if (!ARKADE_ASSET_ID.test(result.assetId))
      throw new Error('Invalid issued asset ID.');
    const details = await wallet.assetManager.getAssetDetails(result.assetId);
    if (details.assetId !== result.assetId || !matches(details.metadata?.prototypeMintKey, mintKey)) {
      throw new Error('Issued identity not verified.');
    }
  }
  catch {
    throw new DemoMintAssetError('Mint submitted, but its asset metadata could not be verified. The outcome is unresolved. Check the explorer before retrying.', result.assetId);
  }
  return result;
}
export async function runDemo({ network }: DemoContext) {
  const assetId = demoGetInput(network, 'asset-id') || '0000';

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  try {
    const result = await demoWithFreshWallet(network, wallet => demoMintAsset(wallet, network, assetId), { identity: MnemonicIdentity.fromMnemonic(demoGetMnemonic(network), { isMainnet: false }), freshContracts: true });
    demoSetInput(network, 'asset-id-' + assetId, result.assetId);
    demoSetInput(network, 'asset-id-' + assetId + '-level', '1');

    //////////////////////////////////////////
    // Assert
    //////////////////////////////////////////
    return demoResult([`AssetID: ${assetId}`, `Arkade asset ID: ${result.assetId}`, `Display title: ${LEVEL_ONE_TITLE}`, 'Metadata level: 1', `Icon: ${LEVEL_ONE_ICON}`, 'Success: true'].join('\n'), { explorer: { network, kind: 'asset', identifier: result.assetId } });
  }
  catch (error) {
    const existingAssetId = error instanceof DemoMintAssetError ? error.assetId : undefined;
    return demoResult([`AssetID: ${assetId}`, `Error: ${demoErrorMessage(error)}`, ...(existingAssetId ? [`Arkade asset ID: ${existingAssetId}`] : []), 'Success: false'].join('\n'), existingAssetId ? { explorer: { network, kind: 'asset', identifier: existingAssetId } } : undefined);
  }
}
