/**
 * khudam — нээлттэй монгол бичиг хөрвүүлэгч
 * Open-source Cyrillic ↔ traditional Mongolian script converter and lexicon.
 *
 * Pure, deterministic, zero-dependency ESM; the lexicon is compiled in at
 * build time and everything runs client-side.
 */
export { convertText } from "./convert.js";
export { FALLBACK_LETTER_MAP, transliterateFallback } from "./fallback.js";
export { lookupWord } from "./lookup.js";
export { normalizeWord } from "./normalize.js";
export { decomposeWord } from "./suffix.js";
export { LEXICON_ENTRY_COUNT } from "./generated/lexicon.js";
export { SUFFIX_COUNT } from "./generated/suffixes.js";
export type { Candidate, CandidateSource, Token } from "./types.js";
