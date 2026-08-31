/* A thin client for Gemini, text and vision.

   The game has no dependencies and this does not add one: Node has
   fetch, and the API is a POST with JSON. Nothing here is imported by
   the game — it is a workshop tool, like tools/shots.js.

   The key is read from GEMINI_API_KEY, or from design/.key, which is
   gitignored. Nothing is ever written into the repository that carries
   it.

     node tools/gemini.js --models        what this key can actually call
     node tools/gemini.js "a question"    a plain text round trip
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOST = 'https://generativelanguage.googleapis.com/v1beta';

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const f = path.join(ROOT, 'design', '.key');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  throw new Error(
    'Gemini anahtarı yok.\n' +
    '  ya  set GEMINI_API_KEY=...\n' +
    '  ya da  design/.key dosyasına yaz (gitignore\'da)');
}

/* Model names move. Rather than hardcoding one and being wrong later,
   this asks the key what it can call and prefers the strongest thing on
   the list, and --models prints the list so a person can pin one. */
const PREFER = [/gemini-.*pro/, /gemini-.*flash/];

async function listModels() {
  const r = await fetch(HOST + '/models?key=' + apiKey());
  if (!r.ok) throw new Error('models ' + r.status + ': ' + (await r.text()).slice(0, 300));
  const j = await r.json();
  return (j.models || [])
    .filter(m => (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0)
    .map(m => m.name.replace(/^models\//, ''));
}

let cachedModel = null;
async function pickModel() {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  if (cachedModel) return cachedModel;
  const all = await listModels();
  for (const want of PREFER) {
    /* newest first, which for these names is the longest-lived
       convention: prefer the one without a dated suffix */
    const hit = all.filter(n => want.test(n)).sort((a, b) => a.length - b.length)[0];
    if (hit) return (cachedModel = hit);
  }
  if (!all.length) throw new Error('bu anahtar hiçbir modeli çağıramıyor');
  return (cachedModel = all[0]);
}

const mimeOf = f => ({
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'
}[path.extname(f).toLowerCase()] || 'image/png');

/* parts: strings become text, existing file paths become inline images.
   opts.schema turns on structured output, opts.system sets the role. */
async function ask(parts, opts) {
  opts = opts || {};
  const model = await pickModel();
  const list = (Array.isArray(parts) ? parts : [parts]).map(p => {
    if (typeof p === 'string' && !(p.length < 400 && fs.existsSync(p) && mimeOf(p))) {
      return { text: p };
    }
    if (typeof p === 'string') {
      return { inline_data: { mime_type: mimeOf(p), data: fs.readFileSync(p).toString('base64') } };
    }
    return p;
  });

  const body = {
    contents: [{ role: 'user', parts: list }],
    generationConfig: Object.assign(
      { temperature: opts.temperature === undefined ? 0.7 : opts.temperature },
      opts.schema ? { responseMimeType: 'application/json', responseSchema: opts.schema } : {})
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

  const url = HOST + '/models/' + model + ':generateContent?key=' + apiKey();
  let last = '';
  /* three tries: these calls carry a dozen screenshots and a rate limit
     or a transient 5xx should not lose the round trip */
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (r.ok) {
      const j = await r.json();
      const cand = (j.candidates || [])[0];
      const text = ((cand && cand.content && cand.content.parts) || [])
        .map(p => p.text || '').join('').trim();
      if (!text) throw new Error('boş yanıt (' + ((cand && cand.finishReason) || '?') + ')');
      return opts.schema ? JSON.parse(text) : text;
    }
    last = r.status + ': ' + (await r.text()).slice(0, 400);
    if (r.status !== 429 && r.status < 500) break;
    await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
  }
  throw new Error('Gemini ' + last);
}

module.exports = { ask, listModels, pickModel };

if (require.main === module) {
  (async () => {
    try {
      if (process.argv.includes('--models')) {
        const all = await listModels();
        console.log(all.join('\n'));
        console.log('\nseçilen: ' + await pickModel());
        return;
      }
      const q = process.argv.slice(2).join(' ') || 'Reply with the single word: ready';
      console.log(await ask(q, { temperature: 0 }));
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  })();
}
