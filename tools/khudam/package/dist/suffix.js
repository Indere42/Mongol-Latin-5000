import { SUFFIXES_JSON } from "./generated/suffixes.js";
import { lookupWord } from "./lookup.js";
import { normalizeWord } from "./normalize.js";
/** NNBSP U+202F joins written-apart suffixes to their stem (data/GRAMMAR.md G1). */
const NNBSP = "\u202f";
const MASCULINE_VOWELS = /[ᠠᠣᠤ]/; // ᠠ ᠣ ᠤ
const FEMININE_VOWELS = /[ᠡᠥᠦᠧ]/; // ᠡ ᠥ ᠦ ᠧ
const VOWELS = /[ᠠ-ᠧ]/;
/** FVS1–FVS3, MVS, nirugu — formatting characters, never the final letter. */
const NON_LETTERS = /[᠊-᠎]+$/u;
let table;
let suffixesLongestFirst;
function getTable() {
    if (table === undefined) {
        table = new Map();
        for (const row of JSON.parse(SUFFIXES_JSON)) {
            const rows = table.get(row[0]);
            if (rows === undefined)
                table.set(row[0], [row]);
            else
                rows.push(row);
        }
        suffixesLongestFirst = [...table.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
    }
    return table;
}
/** The last real letter of a traditional stem, skipping FVS/MVS/nirugu. */
function finalLetter(traditional) {
    const trimmed = traditional.replace(NON_LETTERS, "");
    return trimmed.slice(-1);
}
/**
 * Vowel-harmony class of a traditional stem. Stems containing only ᠢ (or no
 * vowel at all) are "neutral" and satisfy either gender condition — the
 * caller then emits both variants rather than guessing (GRAMMAR.md G2).
 */
export function stemGender(traditional) {
    const masc = MASCULINE_VOWELS.test(traditional);
    const fem = FEMININE_VOWELS.test(traditional);
    if (masc && !fem)
        return "masculine";
    if (fem && !masc)
        return "feminine";
    return "neutral";
}
/**
 * Whether a suffix variant may attach here.
 *
 * The two conditions read different things, which matters once suffixes chain
 * (GRAMMAR.md G12): `attach` is about what the suffix physically follows, so it
 * tests the unit immediately before it — the stem for the first suffix, the
 * previous suffix for the second (гэр + ᠲᠦ + ᠪᠡᠨ: the reflexive takes its
 * vowel-form because ᠲᠦ ends in a vowel, not because ᠭᠡᠷ does). `gender` is
 * vowel harmony, which the stem governs for the whole word.
 */
function conditionsMatch(precedingUnit, stemTraditional, [, , , , attach, gender]) {
    if (attach !== "") {
        const isVowel = VOWELS.test(finalLetter(precedingUnit));
        if (attach === "vowel" ? !isVowel : isVowel)
            return false;
    }
    if (gender !== "") {
        const g = stemGender(stemTraditional);
        if (g !== "neutral" && g !== gender)
            return false;
    }
    return true;
}
/**
 * Attachment order for chained suffixes (GRAMMAR.md G12). A Mongolian nominal
 * builds outward in fixed slots — stem, plural, case, possessive — and a chain
 * is only well-formed if each suffix sits in a strictly later slot than the one
 * before it. This is what stops ном + ы + н being offered as a second reading
 * of номын: two case suffixes cannot stack.
 *
 * Senses not listed here are derivational (the Wiktionary-imported rows carry
 * free-text glosses, not grammatical labels) and take slot 0 — they attach
 * directly to the stem and nothing may precede them.
 */
const SLOTS = {
    plural: 1,
    "collective plural": 1,
    genitive: 2,
    accusative: 2,
    "dative-locative": 2,
    ablative: 2,
    instrumental: 2,
    comitative: 2,
    // privative sits with the cases: it follows a plural (бичгүүдгүй) and
    // precedes a possessive (бичиггүйгээ), and never co-occurs with a case.
    privative: 2,
    substantive: 3,
    "reflexive-possessive": 4,
};
function slotOf([, , , sense]) {
    return SLOTS[sense] ?? 0;
}
/**
 * Suffixes that cannot open a chain, because they convert another suffix
 * rather than attach to a stem. ᠬᠢ is Wiktionary's "converts a genitive to a
 * substantive genitive": номынх is ном + ын + х, and there is no номх.
 *
 * This is also what keeps the row harmless. Cyrillic -х ends every verb
 * infinitive in the language (харих, явах, бичих); without the restriction the
 * engine would offer a substantive reading of all of them.
 */
const NEVER_FIRST = new Set(["substantive"]);
/**
 * Derivational suffixes are excluded from decomposition (ground rule 1:
 * rules never spell stems). -ч, -л, -лт and friends build new words, and a new
 * word is a lexicon entry with its own traditional spelling — deriving it at
 * runtime would be the engine inventing a stem, which is the one thing it must
 * not do. They stay in suffixes.json as grammatical documentation.
 */
function isInflectional(row) {
    return SLOTS[row[3]] !== undefined;
}
/** How many suffixes may be peeled off one word (GRAMMAR.md G12). */
const MAX_DEPTH = 2;
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
export function decomposeWord(word) {
    const w = normalizeWord(word);
    const suffixTable = getTable();
    const results = [];
    const seen = new Set();
    for (const split of peel(w, MAX_DEPTH)) {
        for (const stem of stemsFor(split.base)) {
            for (const rows of variants(split.suffixes, stem.traditional, suffixTable)) {
                let composed = stem.traditional;
                for (const [, traditional] of rows)
                    composed += NNBSP + traditional;
                if (seen.has(composed))
                    continue;
                seen.add(composed);
                const candidate = {
                    traditional: composed,
                    verified: stem.verified && rows.every(([, , , , , , verified]) => verified === 1),
                    source: "suffix-rule",
                    sense: [stem.sense, ...rows.map(([, , , sense]) => sense)].filter(Boolean).join(" + "),
                };
                const latins = rows.map(([, , latin]) => latin);
                if (stem.latin && latins.every(Boolean))
                    candidate.latin = [stem.latin, ...latins].join("-");
                results.push(candidate);
            }
        }
    }
    // Shorter chains first: гэрт read as гэр+т is a likelier answer than any
    // two-suffix reading of the same string, and the UI shows candidates in order.
    return results.sort((a, b) => countUnits(a.traditional) - countUnits(b.traditional));
}
function countUnits(traditional) {
    return traditional.split(NNBSP).length;
}
/** Ways to cut a Cyrillic surface into stem + up to `depth` trailing suffixes,
 *  each `suffixes` listed stem-outward. */
function peel(word, depth) {
    const out = [];
    const walk = (rest, left, outer) => {
        if (left === 0)
            return;
        for (const suffix of suffixesLongestFirst) {
            if (rest.length <= suffix.length || !rest.endsWith(suffix))
                continue;
            const base = rest.slice(0, -suffix.length);
            const chain = [suffix, ...outer];
            out.push({ base, suffixes: chain });
            walk(base, left - 1, chain);
        }
    };
    walk(word, depth, []);
    return out;
}
/** Lexicon stems for a stripped Cyrillic base, with the orthographic repairs
 *  that modern spelling makes necessary (GRAMMAR.md G11, G13). */
function stemsFor(base) {
    const exact = lookupWord(base);
    if (exact.length > 0)
        return exact;
    if (!base.endsWith("ь")) {
        const restored = lookupWord(base + "ь");
        if (restored.length > 0)
            return restored;
    }
    return restoreFleetingVowel(base);
}
/** Cyrillic vowels, for reading the surface shape of a Mongolian word. */
const CYRILLIC_VOWELS = "аеёиоуүөэюя";
/** Back (эрэгтэй) and front (эмэгтэй) vowels; и and ы belong to neither. */
const BACK_VOWELS = "аоуяё";
const FRONT_VOWELS = "эөүе";
/**
 * Which vowel can be the elided one, in the order we try them. Short vowels
 * only, and ы is excluded: it spells suffixes, never a stem's final syllable.
 * The restored vowel must harmonize with the rest of the stem (G2), so the
 * candidate list depends on what class the stem is already in — and и, which
 * harmonizes with everything, comes last unless nothing else can decide.
 */
const FLEETING_BACK = ["а", "о", "у", "и"];
const FLEETING_FRONT = ["э", "ө", "ү", "и"];
const FLEETING_NEUTRAL = ["и", "а", "э", "о", "ө", "у", "ү"];
function fleetingCandidates(base) {
    const back = [...base].some((ch) => BACK_VOWELS.includes(ch));
    const front = [...base].some((ch) => FRONT_VOWELS.includes(ch));
    if (back && !front)
        return FLEETING_BACK;
    if (front && !back)
        return FLEETING_FRONT;
    return FLEETING_NEUTRAL;
}
/**
 * Fleeting vowel (тогтворгүй эгшиг), reversed — GRAMMAR.md G13.
 *
 * A polysyllabic Cyrillic stem drops the short vowel of its last syllable when
 * a suffix follows: бичиг + ийн → бичгийн, ажил + аа → ажлаа. Traditional
 * script keeps the stem whole (ᠪᠢᠴᠢᠭ ᠦᠨ), so this is purely a matter of
 * recovering the Cyrillic lookup key — nothing about the composition changes.
 *
 * We do not predict which vowel was dropped. Vowel harmony narrows the
 * candidates, and then the lexicon decides: it is the authority on which stems
 * exist, and this improves on its own as the lexicon grows. Measured against
 * Wiktionary's declension tables, exactly one stem exists 94% of the time;
 * where two do (сандл → сандал / сандил) both are returned, because choosing
 * between real words is the reader's job, not a rule's.
 */
function restoreFleetingVowel(base) {
    const n = base.length;
    if (n < 3)
        return []; // a monosyllable has no last-syllable vowel to lose
    if (CYRILLIC_VOWELS.includes(base[n - 1]) || CYRILLIC_VOWELS.includes(base[n - 2]))
        return [];
    const out = [];
    for (const vowel of fleetingCandidates(base)) {
        out.push(...lookupWord(base.slice(0, n - 1) + vowel + base[n - 1]));
    }
    return out;
}
/** Every assignment of suffix rows to the chain whose conditions and slot
 *  order all hold. */
function variants(suffixes, stemTraditional, table) {
    let chains = [[]];
    for (const suffix of suffixes) {
        const next = [];
        for (const chain of chains) {
            const previous = chain[chain.length - 1];
            const precedingUnit = previous === undefined ? stemTraditional : previous[1];
            for (const row of table.get(suffix)) {
                if (!isInflectional(row))
                    continue;
                if (previous === undefined && NEVER_FIRST.has(row[3]))
                    continue;
                if (previous !== undefined && slotOf(row) <= slotOf(previous))
                    continue;
                if (!conditionsMatch(precedingUnit, stemTraditional, row))
                    continue;
                next.push([...chain, row]);
            }
        }
        chains = next;
        if (chains.length === 0)
            break;
    }
    return chains;
}
