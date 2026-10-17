/** Where a candidate came from. "suffix-rule" marks a candidate composed by
 * the suffix engine (lexicon stem + grammar rule, see data/GRAMMAR.md);
 * "fallback" marks rule-based transliteration of a word the lexicon does not
 * know — it is never dictionary data. */
export type CandidateSource = "wmk-import" | "wiktionary" | "manual" | "community" | "suffix-rule" | "fallback";
export interface Candidate {
    /** Traditional Mongolian script, standard Unicode logical code points. */
    traditional: string;
    /** Optional romanization. */
    latin?: string;
    /** Meaning label distinguishing candidates of an ambiguous word. */
    sense?: string;
    /** true only when a human reviewer confirmed the spelling. */
    verified: boolean;
    source: CandidateSource;
}
export interface Token {
    /** The slice of (NFC-normalized) input this token covers. */
    input: string;
    /**
     * All known conversions for this token. Empty for separators (whitespace,
     * punctuation, non-Cyrillic runs). Multiple entries mean the word is
     * ambiguous — present the choice to the user, never pick silently.
     */
    candidates: Candidate[];
    /**
     * true when `candidates` holds a rule-based transliteration because the
     * word is missing from the lexicon. Fallback output is approximate and is
     * never disguised as dictionary output.
     */
    fallback: boolean;
}
