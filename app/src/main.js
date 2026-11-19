// Vice Grid — wires the editor: photos into panels, crop sliders, drag to
// pan a photo and drag the panel cards to rearrange, layout/grade/size picks,
// caption editing, and PNG export in the three post sizes.
// A `?shot=` query sets up a fixed scene for a screenshot (./shots.js).
import { SIZES, LAYOUTS, GRADES, drawCover, renderCover, layoutPanels, hitPanel } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const stripEl = document.getElementById('panelStrip');

const state = {
  layout: 'quad',
  grade: 'sunset',
  size: 'square',
  caption: 'Neon Boulevard',
  subtitle: 'A sunset heist in four panels',
  panels: [
    { photo: null, src: null, zoom: 1, ox: 0, oy: 0 },
    { photo: null, src: null, zoom: 1, ox: 0, oy: 0 },
    { photo: null, src: null, zoom: 1, ox: 0, oy: 0 },
    { photo: null, src: null, zoom: 1, ox: 0, oy: 0 },
  ],
};
let selected = 0;
let shotMode = false;

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function redraw() {
  const { w, h } = SIZES[state.size];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas, state);
  drawStrip();
}

/** The panel cards under the preview: a live thumbnail of each panel. */
function drawStrip() {
  const small = renderCover(state, state.size);
  const sw = 240;
  const sh = Math.round((sw * small.height) / small.width);
  const gutter = Math.max(4, small.width * 0.008);
  const bandH = small.height * ({ square: 0.17, portrait: 0.15, landscape: 0.22 })[state.size];
  const area = { x: gutter, y: gutter, w: small.width - 2 * gutter, h: small.height - bandH - 2 * gutter };
  const rects = layoutPanels(state.layout, area, gutter);
  stripEl.innerHTML = '';
  rects.forEach((rect, i) => {
    const figure = document.createElement('figure');
    figure.className = `panel-card${i === selected ? ' selected' : ''}`;
    figure.draggable = true;
    figure.dataset.index = String(i);
    const thumb = document.createElement('canvas');
    const tw = 220;
    const th = Math.max(40, Math.round((tw * rect.h) / rect.w));
    thumb.width = tw;
    thumb.height = th;
    const tctx = thumb.getContext('2d');
    tctx.drawImage(small, rect.x, rect.y, rect.w, rect.h, 0, 0, tw, th);
    const cap = document.createElement('figcaption');
    cap.textContent = `Panel ${i + 1}${state.panels[i].src ? ` · ${state.panels[i].src}` : ''}`;
    figure.append(thumb, cap);
    figure.addEventListener('click', () => { selected = i; syncPanelControls(); redraw(); });
    figure.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(i));
      e.dataTransfer.effectAllowed = 'move';
    });
    figure.addEventListener('dragover', (e) => { e.preventDefault(); figure.classList.add('drag-over'); });
    figure.addEventListener('dragleave', () => figure.classList.remove('drag-over'));
    figure.addEventListener('drop', (e) => {
      e.preventDefault();
      figure.classList.remove('drag-over');
      const from = Number(e.dataTransfer.getData('text/plain'));
      if (Number.isInteger(from) && from !== i) {
        const tmp = state.panels[from];
        state.panels[from] = state.panels[i];
        state.panels[i] = tmp;
        selected = i;
        statusEl.textContent = `Swapped panel ${from + 1} with panel ${i + 1}.`;
        syncPanelControls();
        redraw();
      }
    });
    stripEl.append(figure);
  });
}

/** Segmented button group: one button per option, aria-pressed marks the pick. */
function buildSeg(el, options, current, onPick) {
  el.innerHTML = '';
  for (const [key, label] of Object.entries(options)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(key === current));
    b.addEventListener('click', () => {
      onPick(key);
      buildSeg(el, options, key, onPick);
      redraw();
    });
    el.append(b);
  }
}

function syncPanelControls() {
  const pick = document.getElementById('panelPick');
  pick.innerHTML = '';
  for (let i = 0; i < 4; i += 1) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `Panel ${i + 1}`;
    b.setAttribute('aria-pressed', String(i === selected));
    b.addEventListener('click', () => { selected = i; syncPanelControls(); redraw(); });
    pick.append(b);
  }
  const panel = state.panels[selected];
  const zoom = document.getElementById('zoom');
  const ox = document.getElementById('ox');
  const oy = document.getElementById('oy');
  zoom.value = String(panel.zoom);
  ox.value = String(panel.ox);
  oy.value = String(panel.oy);
  document.getElementById('zoomVal').textContent = `${panel.zoom.toFixed(2)}×`;
  document.getElementById('oxVal').textContent = panel.ox.toFixed(2);
  document.getElementById('oyVal').textContent = panel.oy.toFixed(2);
}

function bindSlider(id, key, format) {
  const input = document.getElementById(id);
  input.addEventListener('input', () => {
    state.panels[selected][key] = Number(input.value);
    document.getElementById(`${id}Val`).textContent = format(Number(input.value));
    redraw();
  });
}
bindSlider('zoom', 'zoom', (v) => `${v.toFixed(2)}×`);
bindSlider('ox', 'ox', (v) => v.toFixed(2));
bindSlider('oy', 'oy', (v) => v.toFixed(2));

document.getElementById('resetPanel').addEventListener('click', () => {
  state.panels[selected] = { photo: null, src: null, zoom: 1, ox: 0, oy: 0 };
  syncPanelControls();
  redraw();
});
document.getElementById('fillAll').addEventListener('click', () => {
  const src = state.panels[selected];
  if (!src.photo) { statusEl.textContent = 'The selected panel has no photo yet.'; return; }
  state.panels = state.panels.map(() => ({ ...src }));
  statusEl.textContent = 'Filled all four panels with the selected photo.';
  redraw();
});

/** Puts `img` (labelled `src`) into the selected panel, then the next empty one. */
async function assignPhoto(img, src) {
  state.panels[selected] = { photo: img, src, zoom: 1, ox: 0, oy: 0 };
  const empty = state.panels.findIndex((p) => !p.photo);
  if (empty !== -1) selected = empty;
  syncPanelControls();
  redraw();
}

document.querySelectorAll('.sample').forEach((b) => {
  b.addEventListener('click', async () => {
    const name = b.dataset.sample;
    try {
      const img = await loadImage(`samples/${name}.jpg`);
      await assignPhoto(img, name);
      statusEl.textContent = `Loaded the ${name} sample into panel ${selected + 1}.`;
    } catch {
      statusEl.textContent = `Could not load samples/${name}.jpg.`;
    }
  });
});

document.getElementById('upload').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  for (const file of files) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      await assignPhoto(img, file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'upload');
    } catch {
      statusEl.textContent = `Could not read ${file.name}.`;
    }
  }
  if (files.length) statusEl.textContent = `${files.length} photo${files.length > 1 ? 's' : ''} loaded — drag the panel cards to rearrange them.`;
  e.target.value = '';
});

// Drag inside the preview pans the photo of the panel under the pointer.
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const i = hitPanel(state, px, py, canvas.width, canvas.height);
  if (i === -1) return;
  selected = i;
  syncPanelControls();
  drag = { index: i, startX: e.clientX, startY: e.clientY, ox: state.panels[i].ox, oy: state.panels[i].oy, rect };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const panel = state.panels[drag.index];
  const scaleX = canvas.width / drag.rect.width;
  const scaleY = canvas.height / drag.rect.height;
  // Pan in panel fractions: dragging right slides the photo right.
  panel.ox = Math.max(-0.5, Math.min(0.5, drag.ox + ((e.clientX - drag.startX) * scaleX) / canvas.width));
  panel.oy = Math.max(-0.5, Math.min(0.5, drag.oy + ((e.clientY - drag.startY) * scaleY) / canvas.height));
  syncPanelControls();
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

document.getElementById('caption').addEventListener('input', (e) => { state.caption = e.target.value; redraw(); });
document.getElementById('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });

buildSeg(document.getElementById('layoutSeg'), LAYOUTS, state.layout, (k) => { state.layout = k; });
buildSeg(document.getElementById('gradeSeg'), GRADES, state.grade, (k) => { state.grade = k; });
buildSeg(
  document.getElementById('sizeSeg'),
  Object.fromEntries(Object.entries(SIZES).map(([k, v]) => [k, v.label])),
  state.size,
  (k) => { state.size = k; },
);

function download(canvasEl, name) {
  canvasEl.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

document.getElementById('export').addEventListener('click', () => {
  const { w, h } = SIZES[state.size];
  download(renderCover(state, state.size), `vice-grid-${state.size}-${w}x${h}.png`);
  statusEl.textContent = `Saved vice-grid-${state.size}-${w}x${h}.png`;
});
document.getElementById('exportAll').addEventListener('click', () => {
  Object.keys(SIZES).forEach((key, i) => {
    setTimeout(() => {
      const { w, h } = SIZES[key];
      download(renderCover(state, key), `vice-grid-${key}-${w}x${h}.png`);
    }, i * 350);
  });
  statusEl.textContent = 'Saved all three sizes: 1080×1080, 1080×1350 and 1920×1080.';
});

// Exposed for the screenshot scenes and for debugging in the console.
window.__viceGrid = { state, redraw, assignPhoto, loadImage, renderCover, SIZES };

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  shotMode = true;
  runShot(shot, new URLSearchParams(location.search), state, { redraw, assignPhoto, loadImage, syncPanelControls });
} else {
  syncPanelControls();
  redraw();
  // Start with both samples in, so the first paint already looks like a poster.
  Promise.all([loadImage('samples/pier.jpg'), loadImage('samples/boulevard.jpg')]).then(([pier, boulevard]) => {
    state.panels[0] = { photo: pier, src: 'pier', zoom: 1.15, ox: 0, oy: -0.05 };
    state.panels[1] = { photo: boulevard, src: 'boulevard', zoom: 1.1, ox: 0.05, oy: 0 };
    state.panels[2] = { photo: boulevard, src: 'boulevard', zoom: 1.4, ox: -0.08, oy: 0.05 };
    state.panels[3] = { photo: pier, src: 'pier', zoom: 1.3, ox: 0.06, oy: 0.04 };
    redraw();
  });
}
