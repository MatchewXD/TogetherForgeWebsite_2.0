from pathlib import Path
import json
import urllib.error
import urllib.request

env = {}
for name in (".env.local", ".env"):
    p = Path(name)
    if not p.exists():
        continue
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

url = env.get("VITE_SUPABASE_URL", "").rstrip("/")
anon = env.get("VITE_SUPABASE_ANON_KEY", "")
print("host", url)
print("has_anon", bool(anon))
if not url or not anon:
    raise SystemExit(1)

headers = {
    "apikey": anon,
    "Authorization": f"Bearer {anon}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

def post(path, body):
    req = urllib.request.Request(
        url + path,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            print("status", resp.status, "body", raw[:400])
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        print("status", e.code, "body", raw[:500])

post("/rest/v1/rpc/idea_cast_vote", {"p_idea_id": 19})
