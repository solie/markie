/* Markie proofreading worker: keeps spell + grammar off the main thread.
 * Absolute asset URLs are supplied by the main thread so this works under
 * any scheme (tauri://, http://, file://). */

let engine = null;
let engineUrlLoaded = null;
const loaded = new Set();

function ensureEngine(engineUrl) {
  if (engine && engineUrlLoaded === engineUrl) return;
  importScripts(engineUrl);
  engine = self.MarkieSpell;
  engineUrlLoaded = engineUrl;
  loaded.clear();
}

async function ensureDictionary(dictBase, locale) {
  if (loaded.has(locale)) return;
  const base = `${dictBase}${locale}`;
  const [affRes, dicRes] = await Promise.all([fetch(`${base}.aff`), fetch(`${base}.dic`)]);
  if (!affRes.ok || !dicRes.ok) throw new Error(`dictionary ${locale} unavailable`);
  engine.loadDictionary(
    new Uint8Array(await affRes.arrayBuffer()),
    new Uint8Array(await dicRes.arrayBuffer())
  );
  loaded.add(locale);
}

self.onmessage = async (event) => {
  const { id, type, text, locale, engineUrl, dictBase } = event.data || {};
  if (type !== "check") return;
  try {
    ensureEngine(engineUrl);
    await ensureDictionary(dictBase, locale || "en-us");
    const result = await engine.check(text || "");
    self.postMessage({ id, ok: true, spelling: result.spelling, grammar: result.grammar });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
