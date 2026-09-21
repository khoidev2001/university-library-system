"""Generate a PlantUML ER diagram from backend/prisma/schema.prisma.

Single source of truth: the Prisma schema. Re-run after every schema change.
Usage: python prisma_to_erd.py [schema.prisma] [out.puml]
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SCHEMA = ROOT / "backend" / "prisma" / "schema.prisma"
DEFAULT_OUT = ROOT / "docs" / "erd" / "erd.puml"

BLOCK_RE = re.compile(r"^(model|enum)\s+(\w+)\s*\{(.*?)^\}", re.M | re.S)
FIELD_RE = re.compile(r"^\s*(\w+)\s+([\w\[\]?]+)\s*(.*)$")


def parse(schema: str) -> tuple[dict, dict]:
    models: dict[str, dict] = {}
    enums: dict[str, list[str]] = {}
    for kind, name, body in BLOCK_RE.findall(schema):
        lines = [l.split("//")[0].rstrip() for l in body.splitlines()]
        lines = [l for l in lines if l.strip()]
        if kind == "enum":
            enums[name] = [l.strip() for l in lines]
            continue
        model = {"table": name, "fields": [], "relations": [], "unique": [], "id": []}
        for line in lines:
            s = line.strip()
            if s.startswith("@@map"):
                model["table"] = re.search(r'"(.+?)"', s).group(1)
                continue
            if s.startswith("@@unique") or s.startswith("@@id"):
                cols = re.search(r"\[(.*?)\]", s).group(1)
                target = model["unique"] if s.startswith("@@unique") else model["id"]
                target.append([c.strip() for c in cols.split(",")])
                continue
            if s.startswith("@@"):
                continue
            m = FIELD_RE.match(line)
            if not m:
                continue
            fname, ftype, attrs = m.groups()
            rel = re.search(r"@relation\((.*?)\)", attrs)
            if rel:
                fields = re.search(r"fields:\s*\[(.*?)\]", rel.group(1))
                if fields:
                    model["relations"].append(
                        {
                            "field": fname,
                            "target": ftype.rstrip("?[]"),
                            "fk": [f.strip() for f in fields.group(1).split(",")],
                            "optional": ftype.endswith("?"),
                        }
                    )
                continue
            if ftype.endswith("[]"):
                continue  # back-relation list
            col = re.search(r'@map\("(.+?)"\)', attrs)
            model["fields"].append(
                {
                    "name": col.group(1) if col else fname,
                    "prisma": fname,
                    "type": ftype.rstrip("?"),
                    "optional": ftype.endswith("?"),
                    "pk": "@id" in attrs,
                    "unique": "@unique" in attrs,
                }
            )
        models[name] = model
    # mark FK columns and composite keys
    for model in models.values():
        fk_prisma = {fk for r in model["relations"] for fk in r["fk"]}
        composite_pk = {c for cols in model["id"] for c in cols}
        for f in model["fields"]:
            f["fk"] = f["prisma"] in fk_prisma
            if f["prisma"] in composite_pk:
                f["pk"] = True
    return models, enums


SQL_TYPES = {"Int": "integer", "String": "varchar", "Boolean": "boolean", "DateTime": "timestamp", "Float": "double"}


def render(models: dict, enums: dict) -> str:
    out = [
        "@startuml erd",
        "' Sinh tự động từ backend/prisma/schema.prisma bằng docs/tools/prisma_to_erd.py — KHÔNG sửa tay",
        "hide circle",
        "skinparam linetype ortho",
        "skinparam entity {",
        "  BackgroundColor #F7F5F0",
        "  BorderColor #1B2A41",
        "}",
        "",
    ]
    for name, model in models.items():
        out.append(f'entity "{model["table"]}" as {name} {{')
        pks = [f for f in model["fields"] if f["pk"]]
        rest = [f for f in model["fields"] if not f["pk"]]
        for f in pks:
            out.append(f'  * {f["name"]} : {SQL_TYPES.get(f["type"], f["type"])} <<PK>>')
        out.append("  --")
        for f in rest:
            tags = []
            if f["fk"]:
                tags.append("FK")
            if f["unique"]:
                tags.append("UQ")
            if f["type"] in enums:
                tags.append("enum")
            tag = f' <<{",".join(tags)}>>' if tags else ""
            bullet = "* " if not f["optional"] else "  "
            out.append(f'  {bullet}{f["name"]} : {SQL_TYPES.get(f["type"], f["type"])}{tag}')
        for cols in model["unique"]:
            out.append(f'  .. UNIQUE({", ".join(cols)}) ..')
        out.append("}")
        out.append("")
    for name, values in enums.items():
        out.append(f"enum {name} {{")
        out.extend(f"  {v}" for v in values)
        out.append("}")
        out.append("")
    for name, model in models.items():
        for r in model["relations"]:
            left = "|o" if r["optional"] else "||"
            out.append(f'{r["target"]} {left}--o{{ {name} : {", ".join(r["fk"])}')
    out.append("@enduml")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    schema_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SCHEMA
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT
    models, enums = parse(schema_path.read_text(encoding="utf-8"))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(render(models, enums), encoding="utf-8")
    print(f"{len(models)} entities, {len(enums)} enums → {out_path}")
