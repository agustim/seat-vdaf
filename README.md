# Assegurança SEAT — Arrendament (VDAF) · Web de consulta

Web estàtica (català) amb tota la informació dels **documents oficials descarregats de
MyGarage** (grup `VDAF`) corresponents al **segur del cotxe d'arrendament secundari** de SEAT:
qui pot conduir, cotxe de substitució, què fer en cas de **punxada**, què fer en cas
d'**accident**, segur de pneumàtics, contactes i documents originals.

## Funcionalitats

- **Respostes ràpides** a les preguntes més habituals, amb referència al document d'origen.
- **Conductors autoritzats** (regla de la *Guia d'usuari*) i la resposta específica per a
  la **neboda de l'empleada** (parent de tercer grau → no inclosa per defecte; confirmar amb
  Parque de Vehículos).
- **Cerca als documents**: BM25 amb **expansió de sinònims català → castellà**
  (p. ex. "punxada" també troba *pinchazo*, "llanda" → *llanta*...). Tot es fa al navegador.
- **Cerca semàntica** opcional: embeddings multilingües (`multilingual-e5-small`) que es
  descarreguen en segon pla i es fusionen amb la cerca per paraules clau.
- **Xat amb IA al navegador**: model `Qwen2.5-0.5B-Instruct` (quantitzat) executat amb
  [Transformers.js](https://huggingface.co/docs/transformers.js) via **WebGPU** (amb càrrega
  de reserva per **WASM**). El model respon només a partir dels fragments recuperats dels
  documents i en **català**, i mostra la font de cada resposta.
- **Documents originals** enllaçats per obrir-los o baixar-los.

## Executar en local

```bash
python3 -m http.server 8000
# obre http://localhost:8000
```

> Cal servir-la per HTTP (els mòduls ES no funcionen amb `file://`).

## Publicar a GitHub Pages

1. Crea un repositori a GitHub i puja-hi aquesta carpeta:
   ```bash
   git init
   git add .
   git commit -m "Web de la documentació d'assegurança SEAT (VDAF)"
   git remote add origin https://github.com/<usuari>/<repositori>.git
   git branch -M main
   git push -u origin main
   ```
2. El repositori ja inclou el workflow
   [`.github/workflows/pages.yml`](.github/workflows/pages.yml), que publica automàticament
   el lloc a **GitHub Pages** (Pages ja queda **activat automàticament** amb l'opció
   `enablement: true`; si el token del workflow no pogués activar-lo, activa'l manualment a
   *Settings → Pages → Source: GitHub Actions*). El lloc queda publicat a
   `https://<usuari>.github.io/<repositori>/` (en aquest cas:
   <https://agustim.github.io/seat-vdaf/>).

### Nota sobre el model d'IA

El model **no es descarrega en obrir la pàgina**: només es baixa quan fas una pregunta
al xat i ho confirmes (~350 MB, Xat consta la confirmació amb el pes i es pot rebutjar per
veure només els fragments recuperats per la cerca). Un cop descarregat queda en
**memòria cau del navegador** (Cache API) i es pot **netejar** en qualsevol moment amb el
botó «🗑 Neteja el model», que allibera l'espai i torna a demanar confirmació la propera
pregunta. La resta de la pàgina (continguts i cerca per paraules clau) funciona sense
connexió ni descàrrega. Recomanat Chrome/Edge o Firefox recent (WebGPU accelera molt
la generació; sense WebGPU funciona amb WASM, més lent).

## Estructura

```
├── index.html                  # pàgina principal (tot el contingut en català)
├── css/style.css               # estils
├── js/
│   ├── main.js                 # lògica de la pàgina (documents, cerca, xat)
│   ├── documents-data.js       # textos dels documents, fragmentats (generat)
│   ├── retrieval.js            # BM25 + sinònims + fusió semàntica
│   └── llm.js                  # càrrega i ús del model d'IA al navegador
├── data/textos/                # textos extrets dels PDF/DOCX (font de documents-data.js)
├── documents/                  # PDF/DOCX originals de MyGarage (grup VDAF)
├── tools/build_data.py         # regenera js/documents-data.js
└── .github/workflows/pages.yml # desplegament automàtic a GitHub Pages
```

## Regenerar les dades dels documents

Si tornes a descarregar versions noves dels documents i vols actualitzar-ne els textos:

```bash
# 1) extreu el text dels PDFs/DOCX a data/textos/ (mantenint els mateixos noms)
pdftotext -layout "documents/SEGURO DE NEUMATICOS.pdf" "data/textos/SEGURO-NEUMATICOS.txt"
# 2) regenera les dades
python3 tools/build_data.py
```

## Avis

Informació elaborada a partir dels documents oficials de MyGarage (grup `VDAF`).
En cas de dubte, contacta amb **Parque de Vehículos** · <parquedevehiculos@seat.es>.
