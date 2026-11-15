// Procedural canvas textures: every surface in the station is painted in
// code, so the game ships no image assets. Each function returns a
// THREE.CanvasTexture ready to repeat across a mesh.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function texture(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function speckle(ctx, w, h, n, color, aMin, aMax, sMin, sMax) {
  for (let i = 0; i < n; i += 1) {
    const a = aMin + Math.random() * (aMax - aMin);
    ctx.fillStyle = color;
    ctx.globalAlpha = a;
    const s = sMin + Math.random() * (sMax - sMin);
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

export function snowTexture() {
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = '#dfe9f5';
  ctx.fillRect(0, 0, 512, 512);
  speckle(ctx, 512, 512, 5200, '#ffffff', 0.25, 0.8, 1, 2.5);
  speckle(ctx, 512, 512, 2600, '#a9bed6', 0.15, 0.5, 1, 3);
  speckle(ctx, 512, 512, 300, '#7e96b5', 0.2, 0.45, 2, 5);
  // faint drift lines, as if wind combed the snow
  ctx.strokeStyle = 'rgba(140,165,195,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i += 1) {
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + 8, 340, y - 8, 512, y + 4);
    ctx.stroke();
  }
  return texture(c, 10, 8);
}

export function panelTexture(base = '#5a6b80', seam = '#3c4a5c') {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 900, '#ffffff', 0.04, 0.12, 1, 2);
  speckle(ctx, 256, 256, 500, '#000000', 0.05, 0.16, 1, 2);
  ctx.strokeStyle = seam;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 252, 252);
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.stroke();
  // rivets
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (const [x, y] of [[14, 14], [242, 14], [14, 242], [242, 242], [128, 14], [128, 242], [14, 128], [242, 128]]) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  return texture(c, 2, 1);
}

export function containerTexture(color = '#7a4a34') {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, 0, 5, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x + 8, 0, 3, 256);
  }
  speckle(ctx, 256, 256, 700, '#000000', 0.05, 0.2, 1, 3);
  // stencil label
  ctx.fillStyle = 'rgba(240,240,230,0.75)';
  ctx.font = 'bold 34px monospace';
  ctx.fillText('A9-07', 28, 140);
  ctx.font = '20px monospace';
  ctx.fillText('AURORA-9', 28, 170);
  return texture(c, 2, 1);
}

export function hazardTexture() {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#e8b73a';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#15181d';
  for (let i = -2; i < 6; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 32, 128);
    ctx.lineTo(i * 32 + 32, 0);
    ctx.lineTo(i * 32 + 64, 0);
    ctx.lineTo(i * 32 + 32, 128);
    ctx.fill();
  }
  return texture(c, 1, 1);
}

export function crateTexture() {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#6b7a72';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 800, '#000000', 0.05, 0.18, 1, 2);
  ctx.strokeStyle = '#42504a';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 246);
  ctx.beginPath();
  ctx.moveTo(5, 5);
  ctx.lineTo(251, 251);
  ctx.moveTo(251, 5);
  ctx.lineTo(5, 251);
  ctx.stroke();
  ctx.fillStyle = 'rgba(230,235,225,0.8)';
  ctx.font = 'bold 30px monospace';
  ctx.fillText('SUPPLY', 68, 140);
  return texture(c, 1, 1);
}

export function signTexture(text, sub = '') {
  const [c, ctx] = canvas(512, 128);
  ctx.fillStyle = '#10161f';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#7fd4ff';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 120);
  ctx.fillStyle = '#e8eef7';
  ctx.font = 'bold 52px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 62);
  if (sub) {
    ctx.fillStyle = '#7fd4ff';
    ctx.font = '28px monospace';
    ctx.fillText(sub, 256, 104);
  }
  return texture(c, 1, 1);
}

export function skyTexture() {
  const [c, ctx] = canvas(16, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#040814');
  g.addColorStop(0.45, '#0a1a33');
  g.addColorStop(0.75, '#12324e');
  g.addColorStop(1, '#2a5a6e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  return texture(c, 1, 1);
}

export function auroraTexture() {
  const [c, ctx] = canvas(512, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(80,255,170,0)');
  g.addColorStop(0.5, 'rgba(80,255,170,0.85)');
  g.addColorStop(1, 'rgba(120,140,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 128);
  return texture(c, 1, 1);
}
