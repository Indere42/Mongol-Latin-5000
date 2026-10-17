/**
 * Canonical form used for every lexicon key and lookup:
 * NFC-normalized, lowercase, trimmed.
 */
export function normalizeWord(input) {
    return input.normalize("NFC").toLowerCase().trim().normalize("NFC");
}
