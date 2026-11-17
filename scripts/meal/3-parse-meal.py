import pymupdf, re, json, collections, sys
d = pymupdf.open(sys.argv[1])
REAL = collections.Counter(x["c"] for x in json.load(open(sys.argv[3], encoding="utf-8")))
MAG = 0xec008c
DEBUG = {int(x) for x in sys.argv[4:]}
AY = re.compile(r"^\s*(\d+)(?:\s*[-–,]\s*(\d+))?\s*[–-](?=\s|$|[^\d])\s*")
HEAD = re.compile(r"^\s*(\d+)\s*[–-]\s*.*S[ÛU]RES", re.I)
REFRE = re.compile(r"\[[0-9][0-9,;\s\-–]*\]")

def join(a, b):
    a = a.rstrip(); b = b.lstrip()
    if not a: return b
    if re.search(r"[a-zçğıöşüâîû]-$", a) and re.match(r"[a-zçğıöşüâîû]", b): return a[:-1] + b
    return a + " " + b

surah = 0; cur = None; out = []; intro = False; gaps = []

def expected():
    return 1 if cur is None or cur["s"] != surah else cur["to"] + 1

def start(n1, n2):
    global cur, intro
    e = expected()
    for k in range(e, n1):
        gaps.append((surah, k))
        out.append({"s": surah, "a": k, "to": k, "m": "", "r": "", "e": [], "missing": True})
    cur = {"s": surah, "a": n1, "to": n2, "m": "", "r": "", "e": []}
    out.append(cur); intro = False

for pi in range(d.page_count):
    for blk in d[pi].get_text("dict")["blocks"]:
        for ln in blk.get("lines", []):
            sp = [s for s in ln["spans"] if s["size"] > 8.5 and s["text"].strip()]
            if not sp: continue
            x = ln["bbox"][0]; text = "".join(s["text"] for s in sp)
            indent = x >= 24
            hm = HEAD.match(text)
            if indent and hm and text.upper() == text:
                surah = int(hm.group(1)); cur = None; intro = True; continue
            if not surah: continue
            # pieces: (text, colour, kind); an ayah number becomes its own piece
            pieces = []
            lm = AY.match(text) if indent else None
            if lm:
                pieces.append((lm.group(0), MAG, "num", True))
                skip = lm.end()
                for s_ in sp:
                    t_ = s_["text"]
                    if skip >= len(t_): skip -= len(t_); continue
                    pieces.append((t_[skip:], s_["color"], "txt", False)); skip = 0
            else:
                for s_ in sp: pieces.append((s_["text"], s_["color"], "txt", False))
            # numbers inside a line, right after the end of a sentence or a reference
            split = []
            for (t_, c_, k_, ls_) in pieces:
                if k_ != "txt": split.append((t_, c_, k_, ls_)); continue
                if re.fullmatch(r"\s*\d+(?:\s*[-,]\s*\d+)?\s*–\s*", t_): split.append((t_, c_, "num", False)); continue
                pos = 0
                for mm in re.finditer(r"(?<=[\]\.!?”’\)])\s*(\d+(?:\s*[-,]\s*\d+)?\s*–)(?=\s)", t_):
                    split.append((t_[pos:mm.start(1)], c_, "txt", False)); split.append((mm.group(1), MAG, "num", False)); pos = mm.end()
                split.append((t_[pos:], c_, "txt", False))
            for si, (t, col, kind, ls) in enumerate(split):
                s = {"color": col}
                m = AY.match(t + " ") if kind == "num" else None
                if m and DEBUG and surah in DEBUG: print("NUM", pi, repr(t), "exp", expected(), "cur", cur and (cur["s"], cur["to"]), "intro", intro, "ls", ls)
                if m:
                    n1 = int(m.group(1)); n2 = int(m.group(2) or n1); e = expected()
                    at_line_start = ls
                    prev = (cur["m"] if cur and not cur["e"] else (cur["e"][-1] if cur and cur["e"] else "")).rstrip()
                    inline_ok = not ls
                    # a surah whose title line was missed starts again at 1
                    if n1 == 1 and cur and cur["s"] == surah and cur["to"] == REAL[surah] and (at_line_start or inline_ok):
                        surah += 1; e = 1
                    if e <= n1 <= e + 1 and n2 >= n1 and n2 <= REAL[surah] and (at_line_start or inline_ok) and not intro or (intro and n1 == 1 and at_line_start):
                        start(n1, n2)
                        continue
                if intro or cur is None: continue
                if not t.strip(): continue
                # references in brackets stay with the meal
                if s["color"] == MAG and REFRE.fullmatch(t.strip()):
                    cur["r"] = join(cur["r"], t); continue
                is_exp = (s["color"] == MAG and bool(cur["m"])) or bool(cur["e"])
                if is_exp:
                    new_par = indent and si == 0
                    if new_par or not cur["e"]: cur["e"].append(t.strip())
                    else: cur["e"][-1] = join(cur["e"][-1], t)
                else:
                    cur["m"] = join(cur["m"], t)

# pull trailing [refs] out of meal text
for o in out:
    refs = REFRE.findall(o["m"])
    if refs:
        o["m"] = REFRE.sub("", o["m"]).strip()
        o["r"] = (o["r"] + " " + " ".join(refs)).strip()
    o["m"] = re.sub(r"\s+", " ", o["m"]).strip()
    o["e"] = [re.sub(r"\s+", " ", e).strip() for e in o["e"] if e.strip()]

json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)
c = collections.Counter()
for o in out: c[o["s"]] += o["to"] - o["a"] + 1
print("entries", len(out), "ayahs", sum(c.values()))
print("bad", [(k, c[k], REAL[k]) for k in range(1, 115) if c[k] != REAL[k]])
print("gaps", gaps)
print("empty", [(o["s"], o["a"]) for o in out if not o["m"] and not o.get("missing")][:30])
