import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export const RECOVERY_WORD_COUNT = 12;
const englishWords = new Set(wordlist);
export const normalizeWord = (word: string) => word.trim().toLowerCase();
export const phraseWords = (phrase: string) => phrase.trim().toLowerCase().split(/\s+/);
export function wordValidity(word: string): 'empty' | 'valid' | 'invalid' {
  const normalized = normalizeWord(word);
  return !normalized ? 'empty' : englishWords.has(normalized) ? 'valid' : 'invalid';
}
export function validRecovery(phrase: string): boolean {
  const words = phraseWords(phrase);
  return words.length === RECOVERY_WORD_COUNT && validateMnemonic(words.join(' '), wordlist);
}
