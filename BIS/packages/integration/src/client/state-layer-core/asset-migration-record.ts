import type { TestNetwork } from './test-network.ts';

export type BisAssetMigrationRecord = Readonly<{
  version: 1;
  id: string;
  ownerProfileId: string;
  network: TestNetwork;
  sourceAssetId: string;
  sourceVersion: string;
  targetVersion: string;
  operationId: string;
  status: 'prepared' | 'replacement-pending' | 'replacement-delivered' | 'retirement-pending' | 'completed';
  replacementAssetId?: string;
}>;

const assetIdPattern=/^[a-f0-9]{68}$/i;
const versionPattern=/^\d+\.\d+\.\d+$/;
const operationPattern=/^[\w-]{1,128}$/;
const prefix=(owner:string,network:TestNetwork)=>`bis-${network}-asset-migration-v1:${encodeURIComponent(owner)}:`;
const key=(record:Pick<BisAssetMigrationRecord,'ownerProfileId'|'network'|'id'>)=>`${prefix(record.ownerProfileId,record.network)}${record.id}`;

export class AssetMigrationRecordError extends Error {
  readonly code:'invalid-input'|'unavailable'|'outcome-unknown';
  constructor(code:'invalid-input'|'unavailable'|'outcome-unknown',message:string){super(message);this.code=code;}
}
function valid(record:unknown,storageKey?:string):record is BisAssetMigrationRecord {
  if(!record||typeof record!=='object')return false;
  const value=record as BisAssetMigrationRecord;
  return value.version===1&&typeof value.id==='string'&&operationPattern.test(value.id)&&typeof value.ownerProfileId==='string'&&value.ownerProfileId.length>0
    &&typeof value.network==='string'&&typeof value.sourceAssetId==='string'&&assetIdPattern.test(value.sourceAssetId)&&versionPattern.test(value.sourceVersion)&&versionPattern.test(value.targetVersion)
    &&typeof value.operationId==='string'&&operationPattern.test(value.operationId)&&['prepared','replacement-pending','replacement-delivered','retirement-pending','completed'].includes(value.status)
    &&(value.replacementAssetId===undefined||assetIdPattern.test(value.replacementAssetId))&&(!storageKey||storageKey===key(value));
}
export function migrationRecordId(sourceAssetId:string,targetVersion:string):string {
  if(!assetIdPattern.test(sourceAssetId)||!versionPattern.test(targetVersion))throw new AssetMigrationRecordError('invalid-input','The source asset or target format is invalid.');
  return `upgrade-${sourceAssetId.toLowerCase().slice(0,32)}-${targetVersion.replaceAll('.','-')}`;
}
export function readAssetMigrationRecords(ownerProfileId:string|undefined,network:TestNetwork='signet'):readonly BisAssetMigrationRecord[] {
  if(!ownerProfileId)return [];
  try {
    const results:BisAssetMigrationRecord[]=[];
    for(let index=0;index<localStorage.length;index++) {
      const storageKey=localStorage.key(index);
      if(!storageKey?.startsWith(prefix(ownerProfileId,network)))continue;
      const record=JSON.parse(localStorage.getItem(storageKey)!);
      if(!valid(record,storageKey)||record.ownerProfileId!==ownerProfileId||record.network!==network||results.some(item=>item.id===record.id))throw Error();
      results.push(Object.freeze(record));
    }
    return Object.freeze(results.sort((a,b)=>a.id.localeCompare(b.id)));
  } catch {throw new AssetMigrationRecordError('outcome-unknown','An asset upgrade needs recovery. Do not create another replacement.');}
}
export function readAssetMigrationRecord(ownerProfileId:string|undefined,sourceAssetId:string,targetVersion:string,network:TestNetwork='signet'):BisAssetMigrationRecord|undefined {
  const id=migrationRecordId(sourceAssetId,targetVersion);
  return readAssetMigrationRecords(ownerProfileId,network).find(record=>record.id===id);
}
export function writeAssetMigrationRecord(record:BisAssetMigrationRecord):BisAssetMigrationRecord {
  if(!valid(record))throw new AssetMigrationRecordError('invalid-input','The asset upgrade recovery record is invalid.');
  const existing=readAssetMigrationRecord(record.ownerProfileId,record.sourceAssetId,record.targetVersion,record.network);
  if(existing&&existing.id!==record.id)throw new AssetMigrationRecordError('outcome-unknown','The source asset already has a different upgrade record.');
  if(existing&&existing.operationId!==record.operationId)throw new AssetMigrationRecordError('outcome-unknown','The asset upgrade operation changed.');
  if(existing?.status==='completed'&&record.status!=='completed')throw new AssetMigrationRecordError('outcome-unknown','The asset upgrade was already completed.');
  const frozen=Object.freeze({...record});
  const raw=JSON.stringify(frozen);
  try {localStorage.setItem(key(frozen),raw);if(localStorage.getItem(key(frozen))!==raw)throw Error();return frozen;}
  catch {throw new AssetMigrationRecordError('unavailable','Asset upgrade recovery could not be saved.');}
}
