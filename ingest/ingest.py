#!/usr/bin/env python3
"""
Reference implementation of the CSV -> snapshot ingestion pipeline.

This is the algorithm the claude.ai Project (see ../docs/CLAUDE_PROJECT_INSTRUCTIONS.md)
follows by hand when it receives a CSV, described here as runnable code so it's
unambiguous and testable. It can also be run directly if Python ever becomes
available in the workflow (e.g. a small server-side cron instead of the
claude.ai Project).

Usage:
    python ingest.py cartes.csv --type cartes --repo-root "F:/A - CARTE POKEMON/Suivie carte pokemon"
    python ingest.py scelles.csv --type scelles --repo-root "F:/A - CARTE POKEMON/Suivie carte pokemon"

Writes data/snapshots/<type>/<timestamp>.json and updates data/index.json.
Does NOT commit/push - that's a separate, explicit step (see DEPLOIEMENT.md).
"""

import argparse
import csv
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

CARD_COLUMNS = {"Nom", "Numéro", "Série", "État", "Version"}


def slugify(value: str) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFD", str(value))
    without_marks = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    lowered = without_marks.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered)
    return slug.strip("-")


def parse_price(raw: str) -> float:
    if not raw:
        return 0.0
    cleaned = re.sub(r"[^\d,.\-]", "", raw).replace(",", ".")
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return 0.0


def base_item_id(row: dict) -> str:
    parts = [slugify(row.get("Nom")), slugify(row.get("Numéro")), slugify(row.get("Série")), slugify(row.get("État")), slugify(row.get("Version"))]
    return "-".join(p for p in parts if p)


def disambiguate_ids(items: list[dict]) -> None:
    """Appends -2, -3... to duplicate base ids, in stable (row) order."""
    counts: dict[str, int] = {}
    for item in items:
        base = item["id"]
        counts[base] = counts.get(base, 0) + 1
        n = counts[base]
        if n > 1:
            item["id"] = f"{base}-{n}"


def parse_cards_csv(csv_path: Path) -> list[dict]:
    items = []
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            items.append(
                {
                    "id": base_item_id(row),
                    "nom": row.get("Nom", "").strip(),
                    "numero": row.get("Numéro", "").strip(),
                    "serie": row.get("Série", "").strip(),
                    "bloc": row.get("Bloc", "").strip(),
                    "etat": row.get("État", "").strip(),
                    "version": row.get("Version", "").strip(),
                    "langue": row.get("Langue Carte", "").strip(),
                    "gradationSociete": row.get("Société de gradation", "").strip(),
                    "gradationNote": row.get("Note de gradation", "").strip(),
                    "prixAchat": parse_price(row.get("Prix Achat", "")),
                    "prixActuel": parse_price(row.get("Prix Actuel", "")),
                }
            )
    disambiguate_ids(items)
    return items


def write_snapshot(repo_root: Path, item_type: str, timestamp: str, items: list[dict], source_name: str) -> Path:
    out_dir = repo_root / "data" / "snapshots" / item_type
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{timestamp}.json"
    snapshot = {"timestamp": timestamp, "source": source_name, "items": items}
    out_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    return out_path


def update_index(repo_root: Path, item_type: str, timestamp: str, count: int, label: str) -> None:
    index_path = repo_root / "data" / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {"cartes": [], "scelles": []}
    index.setdefault(item_type, [])
    index[item_type] = [e for e in index[item_type] if e["timestamp"] != timestamp]
    index[item_type].append(
        {
            "timestamp": timestamp,
            "path": f"data/snapshots/{item_type}/{timestamp}.json",
            "count": count,
            "label": label,
        }
    )
    index[item_type].sort(key=lambda e: e["timestamp"])
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--type", choices=["cartes", "scelles"], required=True)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--timestamp", default=None, help="YYYY-MM-DDThhmm (default: now)")
    args = parser.parse_args()

    timestamp = args.timestamp or datetime.now().strftime("%Y-%m-%dT%H%M")

    if args.type == "cartes":
        items = parse_cards_csv(args.csv_path)
    else:
        raise NotImplementedError(
            "Le format du CSV scellés n'est pas encore défini - complète parse_scelles_csv() "
            "dès qu'un export exemple d'iEstim pour les produits scellés est disponible."
        )

    out_path = write_snapshot(args.repo_root, args.type, timestamp, items, args.csv_path.name)
    update_index(args.repo_root, args.type, timestamp, len(items), f"Import {args.csv_path.name}")

    total = sum(i["prixActuel"] for i in items)
    print(f"Snapshot écrit : {out_path}")
    print(f"{len(items)} items, valeur totale {total:.2f} €")


if __name__ == "__main__":
    main()
