// Lògica de la pàgina: targetes de documents, cerca i xat amb el model local.

import { DOCUMENTS } from './documents-data.js';
import { DocSearch, highlight, escapeHtml } from './retrieval.js';
import { BrowserLLM, LM_LABEL, LM_MODEL } from './llm.js';

const DOC_META = {
  'guia-usuari': {
    desc: 'Guia oficial del programa: sol·licitud, entrega, avaries, accidents, punxada, robatori, multes, préstecs, devolució i conductes autoritzades.',
    type: 'WORD',
  },
  'assistencia-secundari': {
    desc: 'Assistència en carretera 24 h per a vehicles d\'arrendament secundari: avaria, accident, punxada, claus, combustible. Cotxe de substitució: 10 dies (avaria) / 15 dies (accident).',
    type: 'PDF',
  },
  'assistencia-primari': {
    desc: 'Versió del mateix servei per a la flota/empleats. Contingut pràcticament idèntic al document d\'arrendament secundari.',
    type: 'PDF',
  },
  'segur-neumatics': {
    desc: 'Segur de pneumàtics de 36 mesos (SEAT Contigo): cobertures, percentatges de compensació (100/50/25 %) i procés de tramitació.',
    type: 'PDF',
  },
  'telefons': {
    desc: 'Telèfons del call center de Catalunya Motor: Martorell i Zona Franca.',
    type: 'PDF',
  },
  'connect': {
    desc: 'Configuració de SEAT/CUPRA Connect i telèfon d\'incidències digitals.',
    type: 'PDF',
  },
  'car-feedback': {
    desc: 'Formulari d\'opinió: app per donar feedback sobre el vehicle (formulari amb codis QR al PDF).',
    type: 'PDF',
  },
};

// ---------- Targetes de documents ----------
function renderDocs() {
  const grid = document.getElementById('doc-grid');
  for (const doc of DOCUMENTS) {
    const meta = DOC_META[doc.id] || {};
    const chunks = doc.chunks.join(' ');
    const words = chunks ? chunks.split(/\s+/).length : 0;
    const card = document.createElement('article');
    card.className = 'doc-card';
    card.innerHTML = `
      <h3>${escapeHtml(doc.title)}</h3>
      <p class="doc-desc">${escapeHtml(meta.desc || '')}</p>
      <p class="doc-meta">${meta.type || ''} · ${doc.file.split('/').pop()}${
        words ? ` · ~${words} paraules` : ''
      }</p>
      <a class="doc-link" href="${encodeURI(doc.file)}" target="_blank" rel="noopener">⬇ Obre el document original</a>
    `;
    grid.appendChild(card);
  }
}

// ---------- Cerca ----------
const search = new DocSearch();
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchStatus = document.getElementById('search-status');
const searchResults = document.getElementById('search-results');

function snippet(text, query, maxLen = 220) {
  const t = text.replace(/\s+/g, ' ');
  const idx = Math.max(0, t.indexOf(t.split(' ').slice(0, 8).join(' ')));
  if (t.length <= maxLen) return t;
  const start = Math.max(0, idx - 40);
  return (start > 0 ? '…' : '') + t.slice(start, start + maxLen) + '…';
}

async function doSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  const t0 = performance.now();
  searchStatus.textContent = 'Cercant…';
  const results = await search.search(q, 12);
  const ms = Math.round(performance.now() - t0);
  searchStatus.textContent = results.length
    ? `${results.length} resultats · ${ms} ms · ${
        search.semantic ? 'cerca híbrida (semàntica + paraules clau)' : 'cerca per paraules clau'
      }`
    : `Cap resultat per a «${q}». Prova amb altres termes (avaria, substitució, llanda…).`;
  searchResults.innerHTML = '';
  for (const r of results) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="res-title">${escapeHtml(r.doc.title)}</div>
      <div class="res-snippet">${highlight(snippet(r.text, q), q)}</div>
      <div class="res-file">${escapeHtml(r.doc.file)}</div>
    `;
    searchResults.appendChild(li);
  }
}

searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

// ---------- Xat amb IA ----------
const llm = new BrowserLLM();
const modelStatus = document.getElementById('model-status');
const modelProgress = document.getElementById('model-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const modelNote = document.getElementById('model-note');
const btnDownload = document.getElementById('btn-model-download');
const btnClear = document.getElementById('btn-model-clear');

const MODEL_SIZE = '~350 MB';
let loadStarted = false;
let pendingQuestions = [];   // preguntes que esperen una resposta del model
let confirmMsg = null;       // missatge amb la confirmació de descàrrega
let queueMsg = null;         // missatge d'"en cua" mentre es descarrega
let answerChain = Promise.resolve();

function setModelStatus(kind, label) {
  modelStatus.className = 'model-status' + (kind ? ` ${kind}` : '');
  modelStatus.innerHTML = `<span class="model-dot"></span> ${label}`;
}

function refreshModelButtons() {
  btnDownload.hidden = llm.status === 'ready' || llm.status === 'loading';
  btnClear.hidden = llm.status !== 'ready';
  btnDownload.disabled = llm.status === 'loading';
  btnClear.disabled = false;
}

function onProgress(p) {
  modelProgress.hidden = false;
  const percent = p.percent >= 0 ? Math.min(99, Math.round(p.percent)) : null;
  progressFill.style.width = percent !== null ? `${percent}%` : '20%';
  progressText.textContent = percent !== null
    ? `Descarregant el model de ${MODEL_SIZE}… ${percent}% (${p.file || ''})`
    : `Preparant ${p.file || 'el model'}…`;
}

function onStatus(s) {
  if (s === 'ready') {
    modelProgress.hidden = true;
    progressFill.style.width = '100%';
    setModelStatus('ready', `Model ${LM_LABEL} carregat i preparat (${llm.device || 'local'})`);
    modelNote.textContent =
      'El model s\'executa 100 % al teu navegador. Les preguntes i els documents no surten mai de la teva màquina. Pots netejar-lo quan vulguis.';
    refreshModelButtons();
    indexSemantic();
  } else if (s === 'loading') {
    setModelStatus('loading', `Descarregant el model d'IA (${MODEL_SIZE})…`);
    modelNote.textContent =
      `La descàrrega (${MODEL_SIZE}) es fa una sola vegada; després el model queda en memòria cau del navegador i es carrega de seguida.`;
    refreshModelButtons();
  } else if (s === 'error') {
    setModelStatus('error', 'No s\'ha pogut carregar el model. La cerca per paraules clau continua funcionant.');
    modelNote.textContent = 'Comprova la connexió a internet i que el navegador sigui recent (Chrome/Edge/Firefox). Pots tornar-ho a provar amb el botó de descàrrega.';
    refreshModelButtons();
  }
}

function addMsg(kind, html) {
  const div = document.createElement('div');
  div.className = `msg msg-${kind}`;
  div.innerHTML = html;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

function contextBlock(results) {
  return results.slice(0, 6).map((r) => ({
    title: r.doc.title,
    file: r.doc.file,
    text: r.text,
  }));
}

function citeHtml(cites) {
  const seen = new Set();
  const items = [];
  for (const [i, c] of cites.entries()) {
    const key = c.file + i; // manté la numeració original
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(`[${i + 1}] ${escapeHtml(c.title)} — <a href="${encodeURI(c.file)}" target="_blank" rel="noopener">${escapeHtml(c.file)}</a>`);
  }
  return `<div class="cite">📄 Fonts utilitzades:<br>${items.join('<br>')}</div>`;
}

// ---------- Respostes ----------
async function renderAnswer(botDiv, question) {
  const results = await search.search(question, 6);
  try {
    const answer = await llm.answer(question, contextBlock(results));
    botDiv.innerHTML = escapeHtml(answer).replace(/\n/g, '<br>') + citeHtml(contextBlock(results));
  } catch (err) {
    console.error(err);
    renderFallback(botDiv, results, err);
  }
}

function renderFallback(botDiv, results, err) {
  const head = err
    ? `No s'ha pogut generar amb IA (${escapeHtml((err && err.message) || err)}). Aquí tens els fragments més rellevants dels documents:`
    : 'El model d\'IA encara no està actiu. Aquí tens els fragments més rellevants dels documents:';
  botDiv.className = 'msg msg-bot';
  let html = escapeHtml(head);
  if (!results.length) {
    html += '<div class="cite">La cerca per paraules clau no va trobar fragments; prova amb «avaria», «substitució», «llanda»…</div>';
  } else {
    html += results.map((r, i) =>
      `<div class="cite">[${i + 1}] <strong>${escapeHtml(r.doc.title)}</strong><br>${escapeHtml(r.text.slice(0, 300))}…</div>`
    ).join('');
  }
  botDiv.innerHTML = html;
}

// ---------- Xat ----------
function ask(question) {
  const q = question.trim();
  if (!q) return;
  addMsg('user', escapeHtml(q));

  if (llm.status === 'ready') {
    const botDiv = addMsg('bot', 'Pensant…');
    answerChain = answerChain
      .then(() => renderAnswer(botDiv, q))
      .catch((e) => {
        botDiv.className = 'msg msg-error';
        botDiv.textContent = `S'ha produït un error: ${(e && e.message) || e}`;
      });
    return;
  }

  if (llm.status === 'loading') {
    pendingQuestions.push(q);
    if (!queueMsg) {
      queueMsg = addMsg('bot', 'El model s\'està descarregant… la pregunta quedarà en cua i es respondrà en acabar.');
    } else {
      queueMsg.innerHTML = `El model s'està descarregant… ${pendingQuestions.length} pregunta${pendingQuestions.length > 1 ? 's' : ''} en cua.`;
    }
    return;
  }

  if (llm.status === 'error') {
    (async () => {
      const results = await search.search(q, 6);
      renderFallback(addMsg('bot', ''), results, null);
    })();
    return;
  }

  // Model inactiu: cal confirmar la descàrrega
  pendingQuestions.push(q);
  if (!confirmMsg) showConfirmation();
}

function showConfirmation() {
  const div = addMsg('bot', '');
  div.innerHTML =
    `El model d'IA (<code>Qwen2.5-0.5B-Instruct</code>) pesa uns <strong>${MODEL_SIZE}</strong> i s'ha de descarregar ` +
    'de HuggingFace la primera vegada (després queda en memòria cau del navegador i no es torna a baixar).<br>' +
    'Vols descarregar-lo ara per respondre amb IA?' +
    '<div class="choices">' +
    `<button class="choice-btn" id="choice-yes">Sí, descarrega el model (${MODEL_SIZE})</button>` +
    '<button class="choice-btn no" id="choice-no">No, mostra només els fragments</button>' +
    '</div>';
  confirmMsg = div;

  div.querySelector('#choice-yes').addEventListener('click', () => {
    confirmMsg = null;
    div.innerHTML = `Descarregant el model (${MODEL_SIZE})… quan acabi respondré la teva pregunta.`;
    startLoad();
  });
  div.querySelector('#choice-no').addEventListener('click', () => {
    confirmMsg = null;
    div.className = 'msg msg-bot';
    div.innerHTML = 'Entesos: et mostro els fragments més rellevants. Si més endavant fas una pregunta i ho confirmes, es descarregarà el model.';
    const queued = pendingQuestions.splice(0);
    for (const q of queued) {
      (async () => {
        const results = await search.search(q, 6);
        renderFallback(addMsg('bot', ''), results, null);
      })();
    }
  });
}

// ---------- Càrrega / neteja del model ----------
function startLoad() {
  if (loadStarted || llm.status === 'ready') return;
  loadStarted = true;
  llm.load(onProgress, onStatus)
    .then(() => {
      flushPending();
    })
    .catch((e) => {
      console.error(e);
      onStatus('error');
      flushPendingFallback();
    });
}

function flushPending() {
  const queued = pendingQuestions.splice(0);
  if (queueMsg) {
    queueMsg.innerHTML = 'Model llest. Responent…';
    queueMsg = null;
  }
  for (const q of queued) {
    const botDiv = addMsg('bot', 'Pensant…');
    answerChain = answerChain
      .then(() => renderAnswer(botDiv, q))
      .catch((err) => {
        botDiv.className = 'msg msg-error';
        botDiv.textContent = `S'ha produït un error: ${(err && err.message) || err}`;
      });
  }
}

function flushPendingFallback() {
  const queued = pendingQuestions.splice(0);
  if (queueMsg) {
    queueMsg.innerHTML = 'No s\'ha pogut descarregar el model: et mostro els fragments.';
    queueMsg = null;
  }
  for (const q of queued) {
    (async () => {
      const results = await search.search(q, 6);
      renderFallback(addMsg('bot', ''), results, new Error('model no descarregat'));
    })();
  }
}

async function clearModel() {
  btnDownload.disabled = true;
  btnClear.disabled = true;
  setModelStatus(null, 'Netejant la memòria cau del model…');
  let removed = 0;
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      for (const name of names) {
        if (/transformers/i.test(name)) {
          const cache = await caches.open(name);
          removed += (await cache.keys()).length;
          await caches.delete(name);
        }
      }
    }
    try { localStorage.removeItem('transformers.js_config'); } catch { /* opcional */ }
  } catch (e) {
    console.error(e);
  }
  // Descarrega el model de la memòria: la propera pregunta tornarà a demanar confirmació
  llm.status = 'idle';
  llm.lm = null;
  llm.tokenizer = null;
  llm.embedder = null;
  llm.embedderPromise = null;
  loadStarted = false;
  semanticIndex = null;
  search.semantic = null;
  pendingQuestions = [];
  confirmMsg = null;
  queueMsg = null;
  modelProgress.hidden = true;
  progressFill.style.width = '0%';
  setModelStatus(null, removed
    ? `Model netejat (${removed} fitxers eliminats de la memòria cau). Tornarà a demanar confirmació si fas una pregunta.`
    : 'No hi havia res a netejar: el model no estava descarregat.');
  modelNote.textContent = `La propera pregunta et tornarà a demanar si vols descarregar el model (${MODEL_SIZE}). La cerca per paraules clau funciona sempre.`;
  refreshModelButtons();
}

chatSend.addEventListener('click', () => { ask(chatInput.value); chatInput.value = ''; });
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { ask(chatInput.value); chatInput.value = ''; }
});
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => { ask(chip.textContent); });
});

btnDownload.addEventListener('click', () => { startLoad(); });
btnClear.addEventListener('click', () => { clearModel(); });

// ---------- Cerca semàntica (opcional, en segon pla) ----------
let semanticIndex = null;

async function indexSemantic() {
  if (semanticIndex) return;
  semanticIndex = 'building';
  try {
    const keys = [];
    const texts = [];
    for (const doc of DOCUMENTS) {
      for (let ci = 0; ci < doc.chunks.length; ci++) {
        keys.push(`${doc.id}::${ci}`);
        texts.push(`passage: ${doc.chunks[ci]}`);
      }
    }
    const embs = [];
    for (let i = 0; i < texts.length; i++) {
      const v = await llm.embedText(texts[i]);
      if (!v) return;
      embs.push(v);
    }
    const map = new Map();
    for (let i = 0; i < keys.length; i++) map.set(keys[i], embs[i]);
    let cachedQuery = null;
    let cachedVec = null;
    search.setSemanticFn(async (query) => {
      const qk = `query: ${query}`;
      if (qk !== cachedQuery) {
        cachedQuery = qk;
        cachedVec = await llm.embedText(qk);
      }
      if (!cachedVec) return new Map();
      const scores = new Map();
      for (const [k, v] of map) {
        let dot = 0;
        for (let i = 0; i < v.length; i++) dot += v[i] * cachedVec[i];
        scores.set(k, dot);
      }
      return scores;
    });
  } catch { /* sense semàntica: la cerca per paraules clau continua funcionant */ }
}

// ---------- Inici ----------
renderDocs();
setModelStatus(null, `Model sota demanda — encara no s'ha descarregat (${MODEL_SIZE} la primera vegada)`);
modelNote.textContent = `El model (${LM_MODEL}) només es descarrega quan fas una pregunta al xat i ho confirmes. Aquí també el pots descarregar o netejar manualment.`;
refreshModelButtons();
