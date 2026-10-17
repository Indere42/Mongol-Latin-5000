import type { Candidate } from "./types.js";
/** Compact candidate as emitted by scripts/build-data.ts. */
export type CompactCandidate = [
    traditional: string,
    latin: string,
    sense: string,
    verified: 0 | 1,
    source: string
];
/** Decodes compact rows into public candidates. Exported for tests. */
export declare function decodeCandidates(rows: CompactCandidate[]): Candidate[];
/**
 * Exact lexicon lookup after normalization (NFC, lowercase, trim).
 * Returns ALL known candidates — ambiguity is never collapsed to one — or an
 * empty array when the word is unknown. Never returns fallback output; see
 * convertText for the clearly-flagged rule-based fallback.
 */
export declare function lookupWord(cyrillic: string): Candidate[];
