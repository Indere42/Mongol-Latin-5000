import { transliterateFallback } from "./fallback.js";
import { lookupWord } from "./lookup.js";
import { decomposeWord } from "./suffix.js";
/** A run of modern Mongolian Cyrillic letters (either case) is a word. */
const CYRILLIC_RUN_RE = /[а-яёөүА-ЯЁӨҮ]+/gu;
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
export function convertText(text) {
    const input = text.normalize("NFC");
    const tokens = [];
    let consumed = 0;
    for (const match of input.matchAll(CYRILLIC_RUN_RE)) {
        const start = match.index;
        if (start > consumed)
            tokens.push(separatorToken(input.slice(consumed, start)));
        tokens.push(wordToken(match[0]));
        consumed = start + match[0].length;
    }
    if (consumed < input.length)
        tokens.push(separatorToken(input.slice(consumed)));
    return tokens;
}
function separatorToken(input) {
    return { input, candidates: [], fallback: false };
}
function wordToken(input) {
    const candidates = lookupWord(input);
    if (candidates.length > 0)
        return { input, candidates, fallback: false };
    const composed = decomposeWord(input);
    if (composed.length > 0)
        return { input, candidates: composed, fallback: false };
    const transliterated = transliterateFallback(input);
    if (transliterated.length === 0)
        return { input, candidates: [], fallback: false };
    return {
        input,
        candidates: [{ traditional: transliterated, verified: false, source: "fallback" }],
        fallback: true,
    };
}
