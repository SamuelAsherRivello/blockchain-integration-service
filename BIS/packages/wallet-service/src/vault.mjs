import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';

// Never served by the HTTP router. The host must mount this directory privately.
export function openVault(directory) {
  mkdirSync(directory,{recursive:true,mode:0o700});
  const owner=new DatabaseSync(join(directory,'owner.sqlite'));
  try {owner.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE');}catch{owner.close();throw Error('Another wallet service owns this data directory.');}
  let db;
  try {
    const keyPath=join(directory,'vault.key'),dataPath=join(directory,'state.sqlite');
    if(!existsSync(keyPath)) {
      if(existsSync(dataPath))throw Error('Wallet encryption key unavailable.');
      writeFileSync(keyPath,randomBytes(32),{flag:'wx',mode:0o600});
    }
    const key=readFileSync(keyPath);if(key.length!==32)throw Error('Wallet encryption key unavailable.');
    db=new DatabaseSync(dataPath);db.exec('PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS entries (name TEXT PRIMARY KEY, envelope BLOB NOT NULL)');
    const read=db.prepare('SELECT envelope FROM entries WHERE name = ?');
    const write=db.prepare('INSERT INTO entries(name,envelope) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET envelope=excluded.envelope');
    return {
      get(name) {
        const row=read.get(name);if(!row)return null;
        try {const bytes=Buffer.from(row.envelope),decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAAD(Buffer.from(name));decipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString());}
        catch{throw Error('Private wallet state could not be read.');}
      },
      set(name,value) {
        const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(name));
        const bytes=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);
        write.run(name,Buffer.concat([iv,cipher.getAuthTag(),bytes]));
      },
      close(){db.close();owner.exec('ROLLBACK');owner.close();key.fill(0);},
    };
  }catch(error){db?.close();owner.close();throw error;}
}

export function journalStorage(vault) {
  let state=vault.get('journals')??{};
  const update=next=>{vault.set('journals',next);state=next;};
  return {
    get length(){return Object.keys(state).filter(k=>state[k]!==null).length;},
    key(i){return Object.keys(state).filter(k=>state[k]!==null)[i]??null;},
    getItem(key){return state[key]??null;},
    setItem(key,value){update({...state,[key]:String(value)});},
    // Tombstones retain history; no database rows are deleted.
    removeItem(key){update({...state,[key]:null});},
  };
}
