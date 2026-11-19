// Vice Grid — the cover engine. Draws a multi-panel GTA-style poster cover
// (panel grid + Vice City sunset/neon grade + bold condensed caption) onto any
// canvas, at any of the three post sizes. Pure 2D canvas, no network, no fonts
// shipped: the lettering uses the condensed system stack
// ("Noto Sans Condensed" Black where installed, "Arial Narrow" elsewhere).

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  landscape: { w: 1920, h: 1080, label: 'Landscape 1920 × 1080' },
};

export const LAYOUTS = {
  quad: 'Quad grid — 2 × 2 panels',
  hero: 'Hero + 3 — one big panel, three stacked',
  strip: 'Film strip — one wide panel over three',
};

export const GRADES = {
  sunset: 'Sunset — warm orange to hot pink',
  neon: 'Neon — magenta and cyan night',
  noir: 'Noir — high-contrast black and white',
  vice: 'Vice — purple dusk to amber',
};

// The caption band takes this fraction of the cover height, per size.
const BAND = { square: 0.17, portrait: 0.15, landscape: 0.22 };

// Grade recipes: a canvas filter for the photo, then gradient overlays.
const GRADE_RECIPES = {
  sunset: {
    filter: 'saturate(1.38) contrast(1.08) brightness(1.03)',
    overlays: [
      { stops: [[0, 'rgba(255,170,60,0.06)'], [0.55, 'rgba(255,110,60,0.2)'], [1, 'rgba(255,45,140,0.62)']], mode: 'overlay' },
      { stops: [[0, 'rgba(255,190,90,0.36)'], [1, 'rgba(255,190,90,0)']], mode: 'soft-light', radial: true },
    ],
    band: [[0, '#2b0a3d'], [0.55, '#c2187b'], [1, '#ff7a18']],
  },
  neon: {
    filter: 'saturate(1.55) contrast(1.12) brightness(0.98)',
    overlays: [
      { stops: [[0, 'rgba(255,0,160,0.42)'], [0.5, 'rgba(120,0,180,0.12)'], [1, 'rgba(0,220,255,0.4)']], mode: 'overlay' },
      { stops: [[0, 'rgba(0,240,255,0.2)'], [1, 'rgba(0,240,255,0)']], mode: 'soft-light', radial: true },
    ],
    band: [[0, '#12002e'], [0.5, '#a100c2'], [1, '#00c8e0']],
  },
  noir: {
    filter: 'grayscale(1) contrast(1.28) brightness(0.96)',
    overlays: [
      { stops: [[0, 'rgba(255,255,255,0.06)'], [1, 'rgba(0,0,0,0.35)']], mode: 'overlay' },
    ],
    band: [[0, '#0c0c0c'], [1, '#3a3a3a']],
  },
  vice: {
    filter: 'saturate(1.35) contrast(1.08) brightness(1.0)',
    overlays: [
      { stops: [[0, 'rgba(122,40,220,0.4)'], [0.55, 'rgba(220,60,140,0.1)'], [1, 'rgba(255,150,40,0.42)']], mode: 'overlay' },
      { stops: [[0, 'rgba(255,120,220,0.22)'], [1, 'rgba(255,120,220,0)']], mode: 'soft-light', radial: true },
    ],
    band: [[0, '#1c0636'], [0.55, '#7a1fa2'], [1, '#ff9a1f']],
  },
};

/** Panel rectangles for a layout, inside the panel area (x, y, w, h). */
export function layoutPanels(layout, area, gutter) {
  const { x, y, w, h } = area;
  const g = gutter;
  if (layout === 'hero') {
    const leftW = w * 0.58 - g / 2;
    const rightX = x + leftW + g;
    const rightW = w - leftW - g;
    const thirdH = (h - 2 * g) / 3;
    return [
      { x, y, w: leftW, h },
      { x: rightX, y, w: rightW, h: thirdH },
      { x: rightX, y: y + thirdH + g, w: rightW, h: thirdH },
      { x: rightX, y: y + 2 * (thirdH + g), w: rightW, h: thirdH },
    ];
  }
  if (layout === 'strip') {
    const topH = h * 0.52 - g / 2;
    const bottomY = y + topH + g;
    const bottomH = h - topH - g;
    const thirdW = (w - 2 * g) / 3;
    return [
      { x, y, w, h: topH },
      { x, y: bottomY, w: thirdW, h: bottomH },
      { x: x + thirdW + g, y: bottomY, w: thirdW, h: bottomH },
      { x: x + 2 * (thirdW + g), y: bottomY, w: thirdW, h: bottomH },
    ];
  }
  // quad: 2 x 2
  const halfW = (w - g) / 2;
  const halfH = (h - g) / 2;
  return [
    { x, y, w: halfW, h: halfH },
    { x: x + halfW + g, y, w: halfW, h: halfH },
    { x, y: y + halfH + g, w: halfW, h: halfH },
    { x: x + halfW + g, y: y + halfH + g, w: halfW, h: halfH },
  ];
}

/** Which panel (0-3) contains point (px, py) in a cover of w x h, or -1. */
export function hitPanel(state, px, py, w, h) {
  const bandH = h * BAND[state.size];
  const gutter = Math.max(4, w * 0.008);
  const area = { x: gutter, y: gutter, w: w - 2 * gutter, h: h - bandH - 2 * gutter };
  const rects = layoutPanels(state.layout, area, gutter);
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

// Deterministic grain: a small noise tile made once from a seeded PRNG.
let grainTile = null;
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function getGrainTile() {
  if (grainTile) return grainTile;
  const rand = mulberry32(20261119);
  const tile = document.createElement('canvas');
  tile.width = 160; tile.height = 160;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  grainTile = tile;
  return tile;
}

/** Cover-fits one photo into a panel rect, honouring zoom and pan offsets. */
function drawPanelPhoto(ctx, photo, rect, zoom, ox, oy) {
  if (!photo) return;
  const iw = photo.naturalWidth || photo.width;
  const ih = photo.naturalHeight || photo.height;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * zoom;
  const pw = iw * scale;
  const ph = ih * scale;
  // ox/oy are fractions of the panel size, -0.5..0.5; 0 centres the photo.
  const dx = rect.x + (rect.w - pw) / 2 + ox * rect.w;
  const dy = rect.y + (rect.h - ph) / 2 + oy * rect.h;
  ctx.drawImage(photo, dx, dy, pw, ph);
}

/** Paints one panel: photo, grade overlays, bottom scrim, inner edge. */
function drawPanel(ctx, panel, rect, grade) {
  const recipe = GRADE_RECIPES[grade];
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (panel.photo) {
    ctx.filter = recipe.filter;
    drawPanelPhoto(ctx, panel.photo, rect, panel.zoom || 1, panel.ox || 0, panel.oy || 0);
    ctx.filter = 'none';
  } else {
    // Empty panel: a dark placeholder with a dashed frame and a hint.
    ctx.fillStyle = '#241431';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.setLineDash([rect.w * 0.03, rect.w * 0.02]);
    ctx.lineWidth = Math.max(2, rect.w * 0.006);
    ctx.strokeRect(rect.x + rect.w * 0.04, rect.y + rect.h * 0.04, rect.w * 0.92, rect.h * 0.92);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const fs = Math.min(rect.w * 0.09, rect.h * 0.12);
    ctx.font = `700 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('+ ADD PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  for (const overlay of recipe.overlays) {
    let grad;
    if (overlay.radial) {
      grad = ctx.createRadialGradient(
        rect.x + rect.w * 0.85, rect.y + rect.h * 0.1, 0,
        rect.x + rect.w * 0.85, rect.y + rect.h * 0.1, Math.max(rect.w, rect.h),
      );
    } else {
      grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    }
    for (const [stop, color] of overlay.stops) grad.addColorStop(stop, color);
    ctx.globalCompositeOperation = overlay.mode;
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Bottom scrim so panels read as one poster, not four loose photos.
  const scrim = ctx.createLinearGradient(rect.x, rect.y + rect.h * 0.7, rect.x, rect.y + rect.h);
  scrim.addColorStop(0, 'rgba(10,4,20,0)');
  scrim.addColorStop(1, 'rgba(10,4,20,0.3)');
  ctx.fillStyle = scrim;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  // Thin dark inner edge, so the white gutters stay crisp.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(1, rect.w * 0.004);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

/** The caption band: sunset gradient, bold condensed title, small subtitle. */
function drawCaptionBand(ctx, state, w, h) {
  const bandH = h * BAND[state.size];
  const bandY = h - bandH;
  const recipe = GRADE_RECIPES[state.grade];
  const grad = ctx.createLinearGradient(0, bandY, w, bandY + bandH);
  for (const [stop, color] of recipe.band) grad.addColorStop(stop, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandY, w, bandH);
  // Thin white rule above the band.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, bandY, w, Math.max(2, h * 0.004));

  const title = (state.caption || 'UNTITLED').trim().toUpperCase();
  const padX = w * 0.045;
  const maxW = w - 2 * padX;
  let size = bandH * 0.52;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const setFont = (s) => { ctx.font = `900 ${s}px "Noto Sans Condensed", "Arial Narrow", "Helvetica Neue", sans-serif`; };
  setFont(size);
  if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = `${Math.max(1, size * 0.015)}px`;
  while (ctx.measureText(title).width > maxW && size > 10) {
    size -= 2;
    setFont(size);
  }
  const titleY = bandY + bandH * 0.42;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(20,4,32,0.9)';
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeText(title, w / 2, titleY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, w / 2, titleY);

  const sub = (state.subtitle || '').trim().toUpperCase();
  if (sub) {
    const subSize = Math.max(10, bandH * 0.17);
    ctx.font = `italic 700 ${subSize}px Georgia, "Times New Roman", serif`;
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = `${Math.max(1, subSize * 0.22)}px`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(sub, w / 2, bandY + bandH * 0.82);
  }
  if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = '0px';
}

/**
 * Draws the whole cover onto `canvas` (which must already be the export size).
 * `state` holds layout, grade, caption, subtitle and 4 panels.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  // White poster frame: the gutters and outer border are paper white.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const bandH = h * BAND[state.size];
  const gutter = Math.max(4, w * 0.008);
  const area = { x: gutter, y: gutter, w: w - 2 * gutter, h: h - bandH - 2 * gutter };
  const rects = layoutPanels(state.layout, area, gutter);
  for (let i = 0; i < 4; i += 1) drawPanel(ctx, state.panels[i], rects[i], state.grade);
  drawCaptionBand(ctx, state, w, h);
  // Grain + vignette over the whole poster, for a printed-poster feel.
  const tile = getGrainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const vig = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/** Renders the cover at a post size into a fresh canvas and returns it. */
export function renderCover(state, sizeKey) {
  const { w, h } = SIZES[sizeKey];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas, state);
  return canvas;
}
