import {MnemonicIdentity,SingleKey} from '@arkade-os/sdk';
import {generateMnemonic} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english.js';
export function newRecoveryPhrase(){return generateMnemonic(wordlist);}
export function restoreIdentity(kind,secret){
 if(kind==='mnemonic')return MnemonicIdentity.fromMnemonic(secret,{isMainnet:false});
 if(kind===undefined||kind==='single-key')return SingleKey.fromHex(secret);
 throw Error('Unsupported saved account format.');
}
