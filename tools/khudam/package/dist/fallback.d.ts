/**
 * Rule-based Cyrillic → traditional letter map, used ONLY for words the
 * lexicon does not know, and ALWAYS surfaced with fallback: true.
 *
 * Historical Mongolian orthography cannot be recovered from modern Cyrillic
 * by rules (see README) — this is a legibility aid, not dictionary output.
 *
 * The table is plain data based on the standard letter correspondences;
 * corrections are welcome via PR. Notable choices, refine as needed:
 *   - ж AND з map to ᠵ, ч AND ц map to ᠴ (the native-word correspondence);
 *     the dedicated foreign-word letters ᠽ (za) and ᠼ (tsa) are not used yet.
 *   - е/ё/ю/я are written with ᠶ + vowel; vowel harmony (e.g. ю as yu vs yü)
 *     is not modeled.
 *   - й/ы/ь map to ᠢ, ъ is dropped.
 */
export declare const FALLBACK_LETTER_MAP: Readonly<Record<string, string>>;
/**
 * Letter-by-letter transliteration of a Cyrillic word. Characters without a
 * mapping are dropped. May return "" (e.g. for input consisting only of ъ).
 */
export declare function transliterateFallback(word: string): string;
