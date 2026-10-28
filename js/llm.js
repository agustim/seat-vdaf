// Model d'IA al navegador (Transformers.js + ONNX / WebGPU-WASM).
// S'utilitza per respondre preguntes sobre els documents, amb el context
// recuperat prèviament per la cerca. El model es descarrega des de HuggingFace
// la primera vegada i després queda a la memòria cau del navegador.

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

export const LM_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
export const EMBEDDING_MODEL = 'Xenova/multilingual-e5-small';
export const LM_LABEL = 'Qwen2.5-0.5B-Instruct (q4)';

export class BrowserLLM {
  constructor() {
    this.lm = null;
    this.tokenizer = null;
    this.embedder = null;
    this.status = 'idle'; // idle | loading | ready | error
    this.progress = { percent: -1, file: '', done: false };
  }

  async load(onProgress, onStatus) {
    this.status = 'loading';
    onStatus?.('loading');
    const progress_callback = (p) => {
      if (p?.status === 'progress') {
        this.progress = { percent: p.progress ?? 0, file: p.file || '', done: false };
        onProgress?.(this.progress);
      } else if (p?.status === 'done' || p?.status === 'ready') {
        this.progress.done = true;
      } else if (p?.status === 'initiate') {
        onProgress?.({ percent: -1, file: p.file || '', done: false });
      }
    };

    let device = 'wasm';
    if (navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) device = 'webgpu';
      } catch { /* sense WebGPU, seguim amb WASM */ }
    }

    try {
      const tf = await import(TRANSFORMERS_URL);
      try {
        this.tokenizer = await tf.AutoTokenizer.from_pretrained(LM_MODEL, { progress_callback });
        this.lm = await tf.AutoModelForCausalLM.from_pretrained(LM_MODEL, {
          dtype: 'q4',
          device,
          progress_callback,
        });
      } catch (err) {
        // Si WebGPU falla a meitat de càrrega, reintenta amb WASM
        if (device === 'webgpu' && !this.lm) {
          device = 'wasm';
          this.tokenizer = await tf.AutoTokenizer.from_pretrained(LM_MODEL, { progress_callback });
          this.lm = await tf.AutoModelForCausalLM.from_pretrained(LM_MODEL, {
            dtype: 'q4',
            device,
            progress_callback,
          });
        } else {
          throw err;
        }
      }
      // Embeddings (opcional, per a cerca semàntica): en segon pla, sense bloquejar
      this.embedderPromise = tf
        .pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: 'q4', device, progress_callback })
        .then((pipe) => {
          this.embedder = pipe;
          return pipe;
        })
        .catch((err) => {
          this.embedder = null;
          throw err;
        });
      this.device = device;
      this.status = 'ready';
      onStatus?.('ready');
      return { device, tf };
    } catch (err) {
      this.status = 'error';
      onStatus?.('error');
      throw err;
    }
  }

  async embedText(text) {
    try {
      const pipe = this.embedderPromise ? await this.embedderPromise : this.embedder;
      if (!pipe) return null;
      const out = await pipe(text, { pooling: 'mean', normalize: true });
      return Array.from(out.data);
    } catch {
      return null;
    }
  }

  // contexts: [{ title, file, text }] — fragments recuperats per la cerca
  async answer(question, contexts) {
    if (!this.lm) throw new Error('El model encara no està carregat.');

    const frags = contexts
      .map((c, i) => `[${i + 1}] ${c.title}\n${c.text}`)
      .join('\n\n');

    const system =
      'Ets un assistent que respon preguntes sobre la documentació de l\'assegurança i ' +
      'l\'assistència d\'un cotxe SEAT d\'arrendament secundari. ' +
      'Respon SEMPRE en català, de manera concisa i clara. ' +
      'Fes servir únicament la informació dels fragments de documentació facilitats. ' +
      'Si la informació no hi és, digues-ho obertament. ' +
      'Quan facis servir un fragment, cita\'l al final com [n]. ' +
      'No inventis telèfons, terminis ni condicions.\n' +
      'Exemple de resposta correcta:\n' +
      'Pregunta: Què hem de fer si punxem una roda? [1] …\n' +
      'Resposta: En cas de punxada, primer hem de trucar a l\'assistència en carretera al 900 100 721 ' +
      '(Espanya) o al +34 91 594 96 81 (a l\'estranger), que atén les 24 hores. ' +
      'L\'assistència es presta fins i tot si el cotxe no té roda de recanvi; si no es pot reparar sobre la marxa, ' +
      'el vehicle es remolca al Servei Autoritzat SEAT més proper per substituir el pneumàtic [1].';

    const user = `Pregunta: ${question}\n\nFRAGMENTS DE DOCUMENTACIÓ:\n${frags}\n\nRecorda: respon en català (encara que els fragments estiguin en castellà) i cita les fonts al final amb [n].`;

    let input_ids;
    try {
      if (typeof this.tokenizer.apply_chat_template === 'function') {
        const tpl = this.tokenizer.apply_chat_template(
          [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          { tokenize: false, add_generation_prompt: true },
        );
        input_ids = this.tokenizer(tpl, { return_tensor: true });
      } else {
        throw new Error('sense chat template');
      }
    } catch {
      const tpl =
        `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n`;
      input_ids = this.tokenizer(tpl, { return_tensor: true });
    }

    const output = await this.lm.generate({
      input_ids: input_ids.input_ids,
      attention_mask: input_ids.attention_mask,
      max_new_tokens: 420,
      do_sample: true,
      temperature: 0.35,
      top_p: 0.92,
      repetition_penalty: 1.05,
    });

    const full = this.tokenizer.batch_decode(output, { skip_special_tokens: true });
    let text = full[0] || '';
    const prompt = this.tokenizer.decode(input_ids.input_ids[0], { skip_special_tokens: true });
    if (text.startsWith(prompt)) text = text.slice(prompt.length);
    return text.trim();
  }
}
