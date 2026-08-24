import re
from pathlib import Path


def load(p):
    return Path(p).read_text(encoding="utf-8", errors="replace")


def names(sql, kind):
    pats = {
        "table": r"CREATE TABLE(?: IF NOT EXISTS)?\s+([^\s(]+)",
        "function": r"CREATE(?: OR REPLACE)? FUNCTION\s+([^\s(]+)\s*\(",
        "index": r"CREATE(?: UNIQUE)? INDEX(?: IF NOT EXISTS)?\s+([^\s]+)",
        "view": r"CREATE(?: OR REPLACE)? VIEW\s+([^\s]+)",
        "trigger": r"CREATE(?: OR REPLACE)? TRIGGER\s+([^\s]+)",
        "policy": r'CREATE POLICY\s+"?([^"\s]+)"?',
        "type": r"CREATE TYPE\s+([^\s]+)",
    }
    found = set()
    for m in re.finditer(pats[kind], sql, re.I):
        found.add(m.group(1).strip().strip('"').lower())
    return found


st = load("tmp/schema-sync/staging-public.sql")
pr = load("tmp/schema-sync/prod-public.sql")
print(f"chars staging={len(st)} prod={len(pr)}")
for kind in ["table", "function", "index", "view", "trigger", "policy", "type"]:
    a, b = names(st, kind), names(pr, kind)
    only_st = sorted(a - b)
    only_pr = sorted(b - a)
    print(f"\n== {kind} staging={len(a)} prod={len(b)} ==")
    if only_st:
        print("  only staging:")
        for n in only_st:
            print(f"    {n}")
    if only_pr:
        print("  only prod:")
        for n in only_pr:
            print(f"    {n}")
    if not only_st and not only_pr:
        print("  same names")
