# khudam

Нээлттэй монгол бичиг хөрвүүлэгч — open-source Cyrillic ↔ traditional Mongolian script (монгол бичиг) converter and lexicon.

```ts
import { lookupWord, convertText } from "khudam";

lookupWord("аав");
// → [{ traditional: "ᠠᠪᠤ", latin: "aav", verified: false, source: "wmk-import" }]
```

- Zero runtime dependencies, works in the browser and Node/Bun.
- Returns full candidate lists with `verified` flags — never a single silent guess.
- Unknown words get a rule-based transliteration clearly flagged `fallback: true`.

Full documentation, data, and contribution guide: [github.com/bigune/khudam](https://github.com/bigune/khudam).

Code: MIT. Lexicon data: CC BY-SA 4.0.
