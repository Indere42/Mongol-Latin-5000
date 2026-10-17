import type { Candidate } from "./types.js";
/** Compact suffix row as emitted by scripts/build-data.ts. */
export type CompactSuffix = [
    cyrillic: string,
    traditional: string,
    latin: string,
    sense: string,
    attach: "" | "vowel" | "consonant",
    gender: "" | "masculine" | "feminine",
    verified: 0 | 1
];
/**
 * Vowel-harmony class of a traditional stem. Stems containing only ᠢ (or no
 * vowel at all) are "neutral" and satisfy either gender condition — the
 * caller then emits both variants rather than guessing (GRAMMAR.md G2).
 */
export declare function stemGender(traditional: string): "masculine" | "feminine" | "neutral";
/**
 * Splits an inflected Cyrillic word into lexicon stem + known suffixes and
 * returns the composed traditional candidates, or [] when no split works.
 *
 * - Up to two suffixes are stripped, in slot order (номууд+ыг, гэр+т+ээ) —
 *   GRAMMAR.md G12. Deeper chains are still a gap.
 * - Only inflectional suffixes take part; derivation builds stems, and stems
 *   come from the lexicon (ground rule 1).
 * - A stem that misses the lexicon is retried with a restored final ь
 *   (сургуулийн → сургууль, G11) and then with a restored fleeting vowel
 *   (бичгийн → бичиг, G13).
 * - Conditions are evaluated against each TRADITIONAL stem candidate, never
 *   the Cyrillic surface (багшийг → ᠪᠠᠭᠰᠢ ᠶᠢ because ᠪᠠᠭᠰᠢ ends in a vowel).
 * - Every match is returned (`source: "suffix-rule"`), never a silent pick;
 *   verified only when stem and every suffix row are human-verified.
 */
export declare function decomposeWord(word: string): Candidate[];
