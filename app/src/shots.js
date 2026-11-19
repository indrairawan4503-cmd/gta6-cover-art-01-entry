// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded into the panels; ?shot=cover shows the exported cover alone, drawn by
// the app itself at the export size. `layout`, `size`, `grade`, `caption`,
// `subtitle`, `photos` (comma list of sample names, one per panel), `zoom` and
// `oy` (comma lists, one per panel) pick the scene. window.__shotReady is set
// once painted.
const ZOOMS = [1.15, 1.1, 1.45, 1.3];
const OXS = [0, 0.05, -0.08, 0.06];
const OYS = [-0.05, 0, 0.05, 0.04];

function listParam(query, name, fallback) {
  const raw = query.get(name);
  if (!raw) return fallback;
  return raw.split(',').map((v) => Number(v.trim()));
}

export async function runShot(shot, query, state, api) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  state.layout = query.get('layout') ?? state.layout;
  state.size = query.get('size') ?? state.size;
  state.grade = query.get('grade') ?? state.grade;
  state.caption = query.get('caption') ?? state.caption;
  state.subtitle = query.get('subtitle') ?? state.subtitle;
  const names = (query.get('photos') ?? 'pier,boulevard,boulevard,pier').split(',');
  const zooms = listParam(query, 'zoom', ZOOMS);
  const oys = listParam(query, 'oy', OYS);
  const loaded = await Promise.all(
    names.map((name) => api.loadImage(`samples/${name.trim()}.jpg`).catch(() => null)),
  );
  state.panels = loaded.map((photo, i) => ({
    photo,
    src: photo ? names[i].trim() : null,
    zoom: zooms[i] ?? ZOOMS[i % ZOOMS.length],
    ox: OXS[i % OXS.length],
    oy: oys[i] ?? OYS[i % OYS.length],
  }));
  document.getElementById('caption').value = state.caption;
  document.getElementById('subtitle').value = state.subtitle;
  api.syncPanelControls();
  api.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
