import { normalizeWord } from "./normalize.js";
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
export const FALLBACK_LETTER_MAP = {
    а: "ᠠ", // ᠠ
    б: "ᠪ", // ᠪ
    в: "ᠸ", // ᠸ
    г: "ᠭ", // ᠭ
    д: "ᠳ", // ᠳ
    е: "ᠶᠡ", // ᠶᠡ
    ё: "ᠶᠣ", // ᠶᠣ
    ж: "ᠵ", // ᠵ
    з: "ᠵ", // ᠵ (native); foreign words would use ᠽ U+183D
    и: "ᠢ", // ᠢ
    й: "ᠢ", // ᠢ
    к: "ᠺ", // ᠺ
    л: "ᠯ", // ᠯ
    м: "ᠮ", // ᠮ
    н: "ᠨ", // ᠨ
    о: "ᠣ", // ᠣ
    ө: "ᠥ", // ᠥ
    п: "ᠫ", // ᠫ
    р: "ᠷ", // ᠷ
    с: "ᠰ", // ᠰ
    т: "ᠲ", // ᠲ
    у: "ᠤ", // ᠤ
    ү: "ᠦ", // ᠦ
    ф: "ᠹ", // ᠹ
    х: "ᠬ", // ᠬ
    ц: "ᠴ", // ᠴ (native); foreign words would use ᠼ U+183C
    ч: "ᠴ", // ᠴ
    ш: "ᠱ", // ᠱ
    щ: "ᠱ", // ᠱ
    ъ: "", // dropped
    ы: "ᠢ", // ᠢ
    ь: "ᠢ", // ᠢ
    э: "ᠡ", // ᠡ
    ю: "ᠶᠤ", // ᠶᠤ
    я: "ᠶᠠ", // ᠶᠠ
};
/**
 * Letter-by-letter transliteration of a Cyrillic word. Characters without a
 * mapping are dropped. May return "" (e.g. for input consisting only of ъ).
 */
export function transliterateFallback(word) {
    let out = "";
    for (const ch of normalizeWord(word))
        out += FALLBACK_LETTER_MAP[ch] ?? "";
    return out;
}
