#!/usr/bin/env python3
"""Genera js/documents-data.js a partir dels textos extrets dels documents de MyGarage (grup VDAF)."""
import json
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

META = [
    {
        "id": "guia-usuari",
        "file": "documents/GUÍA USUARIO.docx",
        "title": "Guia d'usuari del programa (Car Park SEAT)",
        "source": "GUIA-USUARIO.txt",
    },
    {
        "id": "assistencia-secundari",
        "file": "documents/ASISTENCIA EN CARRETERA CORPORATE ARRENADAMIENTO SECUNDARIO.pdf",
        "title": "Assistència en carretera Corporate — Arrendament secundari",
        "source": "ASISTENCIA-SECUNDARIO.txt",
    },
    {
        "id": "assistencia-primari",
        "file": "documents/ASISTENCIA EN CARRETERA CORPORATE PRIMARIO.pdf",
        "title": "Assistència en carretera Corporate — Primària",
        "source": "ASISTENCIA-PRIMARIO.txt",
    },
    {
        "id": "segur-neumatics",
        "file": "documents/SEGURO DE NEUMATICOS.pdf",
        "title": "Segur de pneumàtics de 36 mesos (SEAT Contigo)",
        "source": "SEGURO-NEUMATICOS.txt",
    },
    {
        "id": "telefons",
        "file": "documents/TELÉFONOS CATALUNYA MOTOR.pdf",
        "title": "Telèfons Catalunya Motor",
        "source": "TELEFONS-CATALUNYA-MOTOR.txt",
    },
    {
        "id": "connect",
        "file": "documents/SEAT CUPRA CONNECT.pdf",
        "title": "SEAT / CUPRA Connect",
        "source": "SEAT-CUPRA-CONNECT.txt",
    },
    {
        "id": "car-feedback",
        "file": "documents/CAR FEEDBACK.pdf",
        "title": "Car Feedback (opinió)",
        "source": "CAR-FEEDBACK.txt",
    },
]

PAGE_NUMBER_RE = re.compile(r"^\s*\d{1,2}\s*$")
SPACE_RE = re.compile(r"[ \t]+")
NON_WORD_RE = re.compile(r"[^\w\s\u00C0-\u017F.,;:()\-/&%€]", re.UNICODE)


def clean_text(raw: str) -> str:
    lines = []
    for line in raw.splitlines():
        line = line.replace("\u000c", "").strip()
        if not line:
            continue
        if PAGE_NUMBER_RE.match(line):
            continue
        # uneix línies sense puntuació final amb la següent (el pdftotext parteix paràgrafs)
        lines.append(line)
    # ajunta línies que semblen continuació d'un paràgraf (no acaben en puntuació forta
    # i la següent no és una "capçalera" en majúscules)
    merged = []
    for line in lines:
        if merged and not line[0].isupper() and len(line) < 120:
            merged[-1] += " " + line
        else:
            merged.append(line)
    text = "\n".join(merged)
    text = NON_WORD_RE.sub(" ", text)
    text = SPACE_RE.sub(" ", text)
    return text.strip()


def split_chunks(text: str, max_len: int = 700, overlap: int = 80):
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks = []
    buf = ""
    for p in paragraphs:
        if len(buf) + len(p) + 1 <= max_len:
            buf = (buf + " " + p).strip()
        else:
            if buf:
                chunks.append(buf)
            # franges llargues: parteix-les pel mig
            while len(p) > max_len:
                cut = p.rfind(" ", 0, max_len)
                if cut < max_len // 2:
                    cut = max_len
                chunks.append(p[:cut].strip())
                p = p[cut:]
                if not p:
                    break
            buf = p
    if buf:
        chunks.append(buf)
    # barreja curta de solapament per a preguntes creuades
    final = []
    for i, c in enumerate(chunks):
        if i > 0 and len(c) > overlap:
            prev_tail = chunks[i - 1][-overlap:]
            final.append(prev_tail + "\n" + c)
        else:
            final.append(c)
    return final


def main():
    out = []
    for meta in META:
        path = os.path.join(BASE, "data", "textos", meta["source"])
        with open(path, encoding="utf-8") as fh:
            raw = fh.read()
        text = clean_text(raw)
        chunks = split_chunks(text)
        out.append(
            {
                "id": meta["id"],
                "file": meta["file"],
                "title": meta["title"],
                "chunks": chunks,
            }
        )
        print(f"{meta['id']}: {len(text)} caràcters → {len(chunks)} fragments")

    js = "// Generat per tools/build_data.py — no editar a mà.\n"
    js += "export const DOCUMENTS = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n"
    dest = os.path.join(BASE, "js", "documents-data.js")
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write(js)
    print(f"\nEscrit: {dest} ({os.path.getsize(dest)} bytes)")


if __name__ == "__main__":
    main()
