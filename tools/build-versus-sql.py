#!/usr/bin/env python3
"""Builds supabase/play/03_versus_games.sql from the files in
supabase/play/source: the SQL template plus the Word Race starting words,
trivia questions and Higher or Lower facts.

Edit the source files (one item per line, tab-separated), then run:
    python3 tools/build-versus-sql.py
"""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = root / "supabase" / "play" / "source"


def text(value):
    return "'" + value.replace("'", "''") + "'"


def rows(name, columns):
    lines = (source / name).read_text(encoding="utf-8").strip().split("\n")
    result = [line.split("\t") for line in lines]

    for number, row in enumerate(result, 1):
        if len(row) != columns:
            raise SystemExit(f"{name} line {number}: expected {columns} columns, found {len(row)}")

    return result


seeds = [row[0] for row in rows("word-race-starting-words.txt", 1)]
questions = rows("trivia-questions.tsv", 6)
facts = rows("higher-lower-facts.tsv", 3)

for number, row in enumerate(questions, 1):
    if len(set(row[2:])) != 4:
        raise SystemExit(f"trivia-questions.tsv line {number}: the 4 choices must be different")

sql = (source / "03_versus_games.template.sql").read_text(encoding="utf-8")
sql = sql.replace("{SEEDS}", ",\n".join(f"  ({text(word)})" for word in seeds))
sql = sql.replace("{TRIVIA}", ",\n".join(
    f"  ({i}, {text(row[0])}, {text(row[1])}, array[{', '.join(text(choice) for choice in row[2:])}])"
    for i, row in enumerate(questions, 1)
))
sql = sql.replace("{HL}", ",\n".join(
    f"  ({i}, {text(row[0])}, {text(row[1])}, {float(row[2]):g})" if "e" not in f"{float(row[2]):g}"
    else f"  ({i}, {text(row[0])}, {text(row[1])}, {int(row[2])})"
    for i, row in enumerate(facts, 1)
))

(root / "supabase" / "play" / "03_versus_games.sql").write_text(sql, encoding="utf-8")
print(f"{len(seeds)} starting words, {len(questions)} questions, {len(facts)} facts")
