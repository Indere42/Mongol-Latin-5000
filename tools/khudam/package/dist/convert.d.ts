import type { Token } from "./types.js";
/**
 * Tokenizes text and converts it word by word.
 *
 * - The input is NFC-normalized first; concatenating token.input values
 *   reconstructs the normalized input exactly.
 * - Cyrillic words become word tokens with the full candidate list from the
 *   lexicon (candidates carry verified flags; ambiguity is never collapsed).
 * - Words missing from the lexicon are tried as stem + suffix (see
 *   suffix.ts); composed candidates are flagged source: "suffix-rule".
 * - Words that fail both get a rule-based transliteration flagged
 *   fallback: true — never disguised as dictionary output.
 * - Everything else (whitespace, punctuation, Latin, digits) is passed
 *   through as separator tokens with no candidates.
 */
export declare function convertText(text: string): Token[];
