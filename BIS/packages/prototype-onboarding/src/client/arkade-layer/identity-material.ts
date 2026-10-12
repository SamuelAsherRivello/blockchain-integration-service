import {MnemonicIdentity,SingleKey} from '@arkade-os/sdk';
import {generateMnemonic,validateMnemonic} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english.js';
export function newRecoveryPhrase(){return generateMnemonic(wordlist);}
export function normalizeRecoveryPhrase(value){
 const phrase=typeof value==='string'?value.normalize('NFKD').trim().toLowerCase().split(/\s+/).join(' '):'';
 if(!validateMnemonic(phrase,wordlist))throw Error('Enter a valid English BIP39 seed phrase (12, 15, 18, 21, or 24 words).');
 return phrase;
}
export function restoreIdentity(kind,secret){
 if(kind==='mnemonic')return MnemonicIdentity.fromMnemonic(secret,{isMainnet:false});
 if(kind===undefined||kind==='single-key')return SingleKey.fromHex(secret);
 throw Error('Unsupported saved account format.');
}
