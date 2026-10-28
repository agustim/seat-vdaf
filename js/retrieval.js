// Cerca de documents: BM25 amb expansió de sinònims català→castellà i
// fusió opcional amb cerca semàntica (embeddings). Sense dependències externes.

import { DOCUMENTS } from './documents-data.js';

// Normalització: minúscules + treure accents + només caràcters alfanumèrics
export function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Paraules sense valor informatiu (català i castellà) que només aporten soroll
const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'les', 'els', 'lo', 'los', 'las', 'un', 'una', 'uns', 'unes',
  'que', 'i', 'y', 'en', 'per', 'amb', 'al', 'als', 'a', 'es', 's', 'd', 'l', 'ni', 'o',
  'u', 'no', 'si', 'se', 'su', 'sus', 'mi', 'tu', 'meu', 'meva', 'teu', 'teva', 'nostre',
  'nostra', 'vostre', 'vostra', 'son', 'son', 'sua', 'suo',
  'con', 'para', 'por', 'como', 'cuando', 'donde', 'pero', 'mas', 'más', 'muy', 'todo',
  'toda', 'todos', 'todas', 'cada', 'este', 'esta', 'este', 'esto', 'ese', 'esa', 'eso',
  'aquest', 'aquesta', 'aquests', 'aquestes', 'aquell', 'aquella', 'aquells', 'aquelles',
  'aixo', 'aixo', 'una', 'en', 'fer', 'tenc', 'tinc', 'te', 'tenir', 'haver', 'esta',
  'estan', 'ser', 'és', 'es', 'van', 'va', 'ha', 'hem', 'heu', 'han', 'hi', 'ho', 'tot',
  'us', 'ens', 'em', 'et', 'els', 'hari', 'nom', 'sobre', 'entre', 'fins', 'des', 'sota',
  'cap', 'contra', 'segons', 'amb', 'durant', 'sense', 'abans', 'despres', 'ara', 'aqui',
  'alla', 'alli', 'quan', 'on', 'com', 'perque', 'perque', 'quan', 'que', 'qual', 'quals',
  'quin', 'quina', 'quins', 'quines', 'cuant', 'cuanta', 'cuantos', 'cuantas',
  'quants', 'quantes', 'quant', 'quanta',
]);

export function tokenize(text) {
  return normalize(text).split(' ').filter((t) => t && !STOPWORDS.has(t));
}

// Expansió de sinònims: termes catalans → equivalents castellans (els documents són en castellà)
const SYNONYMS = {
  'punxada': ['pinchazo'], 'punxades': ['pinchazos'], 'punxar': ['pinchar'], 'punxat': ['pinchado'],
  'roda': ['rueda'], 'rodes': ['ruedas'], 'neumatic': ['neumatico'], 'neumatics': ['neumaticos'],
  'llanda': ['llanta'], 'llandes': ['llantas'], 'llanta': ['llanta'], 'avaria': ['averia'], 'averies': ['averias'],
  'cotxe': ['coche', 'vehiculo'], 'cotxes': ['coches', 'vehiculos'], 'vehicul': ['vehiculo'], 'vehicles': ['vehiculos'],
  'asseguranca': ['seguro', 'poliza'], 'assegurança': ['seguro', 'poliza'], 'assegurances': ['seguros'], 'polissa': ['poliza'],
  'sinistre': ['siniestro'], 'sinistres': ['siniestros'],
  'conductor': ['conductor'], 'conductors': ['conductores'], 'conduir': ['conducir'], 'condueix': ['conduce'],
  'carnet': ['carne', 'permiso'], 'permis': ['carne', 'permiso'],
  'substitucio': ['sustitucion', 'sustituto'], 'substitutiu': ['sustitucion', 'sustituto'], 'substituir': ['sustituir'],
  'prestec': ['prestamo'], 'prestecs': ['prestamos'], 'prestamo': ['prestamo'],
  'accident': ['accidente'], 'accidents': ['accidentes'],
  'viatge': ['viaje'], 'viatges': ['viajes'], 'estranger': ['extranjero'], 'domicili': ['domicilio'],
  'temps': ['tiempo', 'duracion'], 'temps': ['tiempo', 'duracion'], 'durada': ['duracion'], 'duracio': ['duracion'],
  'denuncia': ['denuncia'], 'denuncies': ['denuncias'], 'policia': ['policia'],
  'repostar': ['repostar'], 'combustible': ['combustible'], 'gasolina': ['gasolina'],
  'claus': ['llaves'], 'clau': ['llave'],
  'germana': ['hermana'], 'germanes': ['hermanas'], 'germa': ['hermano'], 'germans': ['hermanos'],
  'pare': ['padre', 'papa'], 'mares': ['madres'], 'mare': ['madre'], 'fills': ['hijos'], 'fill': ['hijo'],
  'filla': ['hija'], 'neboda': ['sobrina'], 'nebode': ['sobrino'], 'nebodes': ['sobrinos'],
  'cunyada': ['cunada'], 'cunyat': ['cunado'],
  'parella': ['pareja'], 'conjuge': ['conyuge'], 'casat': ['casado'],
  'primer': ['primer'], 'grau': ['grado'],
  'assegurada': ['asegurada'], 'assegurat': ['asegurado'], 'cobreix': ['cubre'], 'cobertura': ['cobertura'],
  'frontera': ['bordillo', 'frontera'], 'vorada': ['bordillo'], 'vorades': ['bordillos'],
  'vandalisme': ['vandalismo'], 'robatori': ['robo'], 'robada': ['robado'], 'robar': ['robar'], 'roben': ['roban'],
  'recanvi': ['recambio', 'repuesto'], 'recanvis': ['recambios', 'repuestos'],
  'taller': ['taller', 'servicio'], 'tallers': ['talleres', 'servicios'], 'concessionari': ['concesionario'],
  'concessionaris': ['concesionarios'], 'garantia': ['garantia'], 'factura': ['factura'],
  'peritatge': ['peritacion'], 'perit': ['perito'], 'asseguradora': ['aseguradora'],
  'multa': ['multa'], 'multes': ['multas'], 'grua': ['grua'],
  'remolc': ['remolque'], 'remolcar': ['remolcar'], 'remolcaran': ['remolcara'],
  'reparacio': ['reparacion'], 'transport': ['transporte'], 'trasllat': ['traslado'], 'traslladar': ['trasladar'],
  'allotjament': ['alojamiento'], 'hotel': ['hotel'], 'nit': ['noche'], 'nits': ['noches'],
  'laborable': ['laborable'], 'laborables': ['laborables'], 'dies': ['dias'], 'dia': ['dia'],
  'bateria': ['bateria'], 'tancament': ['cierre'], 'amistos': ['amistoso', 'amistosa'],
  'part': ['parte', 'declaracion'], 'croquis': ['croquis'], 'testimonis': ['testigos'], 'testimoni': ['testigo'],
  'permes': ['permitido', 'autorizado'], 'autoritzats': ['autorizados'], 'autoritzat': ['autorizado'],
  'empresa': ['empresa', 'flota'], 'flota': ['flota'], 'dades': ['datos'], 'dada': ['dato'],
  'quants': ['cuantos', 'cuantos'], 'quantes': ['cuantas'], 'quant': ['cuanto', 'cuanto'], 'durant': ['durante'],
  'endavant': ['adelante'], 'maniobres': ['manobras'], 'puja': ['sube'],
};

export function expandQuery(tokens) {
  const out = [];
  for (const t of tokens) {
    out.push(t);
    const syn = SYNONYMS[t];
    if (syn) out.push(...syn);
  }
  return out;
}

function buildIndex(docs) {
  const entries = [];
  for (const doc of docs) {
    for (const [ci, text] of doc.chunks.entries()) {
      const toks = tokenize(text);
      entries.push({ docId: doc.id, ci, text, toks });
    }
  }
  return entries;
}

export class DocSearch {
  constructor(docs = DOCUMENTS) {
    this.docs = docs;
    this.entries = buildIndex(docs);
    this.N = this.entries.length;
    this.df = new Map();
    for (const e of this.entries) {
      for (const t of new Set(e.toks)) {
        this.df.set(t, (this.df.get(t) || 0) + 1);
      }
    }
    this.avgdl = this.entries.reduce((s, e) => s + e.toks.length, 0) / Math.max(1, this.N);
    this.semantic = null; // funció opcional: (query) => Map<chunkKey, score>
  }

  key(docId, ci) { return `${docId}::${ci}`; }

  setSemanticFn(fn) { this.semantic = fn; }

  bm25Scores(qTokens) {
    const k1 = 1.5, b = 0.75;
    const scores = new Map();
    const uniq = [...new Set(qTokens)];
    for (const e of this.entries) {
      let s = 0;
      const tf = new Map();
      for (const t of e.toks) tf.set(t, (tf.get(t) || 0) + 1);
      for (const t of qTokens) {
        const f = tf.get(t);
        if (!f) continue;
        const n = this.df.get(t) || 0;
        const idf = Math.log(1 + (this.N - n + 0.5) / (n + 0.5));
        const denom = f + k1 * (1 - b + b * (e.toks.length / this.avgdl));
        s += idf * (f * (k1 + 1)) / denom;
      }
      // Bonus de proximitat: els termes de la consulta han d'aparèixer junts
      // (ajuda a distingir fragments temàtics en documents amb columnes)
      if (uniq.length >= 2 && s > 0) {
        const pos = new Map();
        for (let i = 0; i < e.toks.length; i++) {
          if (!pos.has(e.toks[i])) pos.set(e.toks[i], i);
        }
        for (let i = 0; i < uniq.length; i++) {
          for (let j = i + 1; j < uniq.length; j++) {
            const pi = pos.get(uniq[i]);
            const pj = pos.get(uniq[j]);
            if (pi !== undefined && pj !== undefined && Math.abs(pi - pj) <= 8) {
              const ni = this.df.get(uniq[i]) || 0;
              const nj = this.df.get(uniq[j]) || 0;
              const idfI = Math.log(1 + (this.N - ni + 0.5) / (ni + 0.5));
              const idfJ = Math.log(1 + (this.N - nj + 0.5) / (nj + 0.5));
              s += 0.8 * (idfI + idfJ) / 2;
            }
          }
        }
      }
      if (s > 0) scores.set(this.key(e.docId, e.ci), s);
    }
    return scores;
  }

  async search(query, k = 10) {
    const qTokens = expandQuery(tokenize(query));
    const bm = this.bm25Scores(qTokens);
    let combined = new Map(bm);
    if (this.semantic) {
      let sem = null;
      try { sem = await this.semantic(query); } catch { sem = null; }
      if (sem) {
        const keys = new Set([...bm.keys(), ...sem.keys()]);
        const bmMax = Math.max(1, ...bm.values());
        const semMax = Math.max(1e-9, ...sem.values());
        combined = new Map();
        for (const key of keys) {
          const score = 0.55 * ((bm.get(key) || 0) / bmMax) + 0.45 * ((sem.get(key) || 0) / semMax);
          if (score > 0) combined.set(key, score);
        }
      }
    }
    const sorted = [...combined.entries()].sort((a, b) => b[1] - a[1]).slice(0, k);
    return sorted.map(([key, score]) => {
      const [docId, ci] = key.split('::');
      const doc = this.docs.find((d) => d.id === docId);
      return { doc, ci: Number(ci), text: doc.chunks[Number(ci)], score };
    });
  }
}

export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function highlight(text, query) {
  const tokens = new Set(expandQuery(tokenize(query)).filter((t) => t.length > 2));
  if (!tokens.size) return escapeHtml(text);
  // Se parem les paraules conservant els separadors per poder ressaltar
  // sense perdre els accents originals del text.
  const parts = text.split(/(\s+)/);
  return parts
    .map((part) => {
      if (!part || /^\s+$/.test(part)) return escapeHtml(part);
      if (tokens.has(normalize(part))) return `<mark>${escapeHtml(part)}</mark>`;
      return escapeHtml(part);
    })
    .join('');
}
