"""批量生成蒙古语单词音频（edge-tts / mn-MN）"""
import asyncio
import json
import os
import re
import sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORDS = os.path.join(ROOT, "data", "words.js")
OUT = os.path.join(ROOT, "audio")
VOICE = sys.argv[1] if len(sys.argv) > 1 else "mn-MN-YesuiNeural"
CONC = 4


def load_words():
    raw = open(WORDS, encoding="utf-8").read()
    m = re.search(r"window\.WORDS=(\[.*?\]);", raw, re.S)
    if not m:
        raise SystemExit("cannot parse words.js")
    return json.loads(m.group(1))


async def one(word, sem, stats):
    path = os.path.join(OUT, word["au"] + ".mp3")
    if os.path.exists(path) and os.path.getsize(path) > 500:
        stats["skip"] += 1
        return
    async with sem:
        for attempt in range(3):
            try:
                c = edge_tts.Communicate(word["cyr"], VOICE, rate="-10%")
                tmp = path + ".tmp"
                await c.save(tmp)
                if os.path.getsize(tmp) > 500:
                    os.replace(tmp, path)
                    stats["ok"] += 1
                else:
                    stats["fail"] += 1
                break
            except Exception as e:  # noqa: BLE001
                if attempt == 2:
                    stats["fail"] += 1
                    print("FAIL", word["cyr"], e, flush=True)
                else:
                    await asyncio.sleep(1.5 * (attempt + 1))


async def main():
    os.makedirs(OUT, exist_ok=True)
    words = load_words()
    sem = asyncio.Semaphore(CONC)
    stats = {"ok": 0, "fail": 0, "skip": 0}
    tasks = [one(w, sem, stats) for w in words]
    done = 0
    for coro in asyncio.as_completed(tasks):
        await coro
        done += 1
        if done % 50 == 0:
            print(f"{done}/{len(words)} ok={stats['ok']} fail={stats['fail']} skip={stats['skip']}", flush=True)
    print("DONE", stats, flush=True)


asyncio.run(main())
