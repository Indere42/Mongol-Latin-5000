import { LEXICON_JSON } from "./generated/lexicon.js";
import { normalizeWord } from "./normalize.js";
const SOURCE_NAMES = {
    w: "wmk-import",
    k: "wiktionary",
    m: "manual",
    c: "community",
};
let table;
function getTable() {
    if (table === undefined)
        table = JSON.parse(LEXICON_JSON);
    return table;
}
/** Decodes compact rows into public candidates. Exported for tests. */
export function decodeCandidates(rows) {
    return rows.map(([traditional, latin, sense, verified, source]) => {
        const out = {
            traditional,
            verified: verified === 1,
            source: SOURCE_NAMES[source] ?? "community",
        };
        if (latin)
            out.latin = latin;
        if (sense)
            out.sense = sense;
        return out;
    });
}
/**
 * Exact lexicon lookup after normalization (NFC, lowercase, trim).
 * Returns ALL known candidates — ambiguity is never collapsed to one — or an
 * empty array when the word is unknown. Never returns fallback output; see
 * convertText for the clearly-flagged rule-based fallback.
 */
export function lookupWord(cyrillic) {
    const rows = getTable()[normalizeWord(cyrillic)];
    return rows === undefined ? [] : decodeCandidates(rows);
}
