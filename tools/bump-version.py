#!/usr/bin/env python3
"""Set a new app version in index.html and version.json.

Run before merging a change so open apps show "A new version is ready".
Usage: python3 tools/bump-version.py            (uses today's date + counter)
       python3 tools/bump-version.py 2026.11.01.1
"""
import datetime
import json
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parent.parent
index = root / "index.html"
version_file = root / "version.json"

current = json.loads(version_file.read_text())["version"]

if len(sys.argv) > 1:
    new = sys.argv[1]
else:
    today = datetime.date.today().strftime("%Y.%m.%d")
    count = int(current.rsplit(".", 1)[1]) + 1 if current.startswith(today + ".") else 1
    new = f"{today}.{count}"

text = index.read_bytes().decode("utf-8")
updated, n = re.subn(r'(<meta name="app-version" content=")[^"]*(">)', rf"\g<1>{new}\g<2>", text)
if n != 1:
    sys.exit("app-version meta tag not found in index.html")
updated = re.sub(r"(\.(?:css|js)\?v=)[0-9.]+", rf"\g<1>{new}", updated)

index.write_bytes(updated.encode("utf-8"))
version_file.write_text(json.dumps({"version": new}, indent=2) + "\n")
print(f"{current} -> {new}")
