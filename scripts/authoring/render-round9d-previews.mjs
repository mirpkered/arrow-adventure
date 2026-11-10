import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const prototypes = JSON.parse(readFileSync(resolve(root, 'src/game/prototypes/round9d-prototypes.json'), 'utf8'));
const out = resolve(root, 'docs/previews/round-9d');
mkdirSync(out, { recursive: true });

const esc = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const toBoard = ({ x, y }) => ({ x: x + 0.5, y: y + 0.5 });

function geometryBounds(entry) {
  const points = [];
  for (const arrow of entry.puzzle.arrows) {
    const path = arrow.path.map(toBoard);
    points.push(...path);
    const tail = path[0]; points.push({ x: tail.x - 0.09, y: tail.y - 0.09 }, { x: tail.x + 0.09, y: tail.y + 0.09 });
    const end = path.at(-1); const previous = path.at(-2);
    const dx = end.x - previous.x; const dy = end.y - previous.y; const length = Math.hypot(dx, dy);
    const ux = dx / length; const uy = dy / length; const px = -uy; const py = ux;
    const tip = { x: end.x + ux * 0.36, y: end.y + uy * 0.36 };
    const base = { x: end.x + ux * 0.07, y: end.y + uy * 0.07 };
    points.push(tip, { x: base.x + px * 0.17, y: base.y + py * 0.17 }, { x: base.x - px * 0.17, y: base.y - py * 0.17 });
  }
  const padding = 0.075;
  return {
    minX: Math.min(...points.map(({ x }) => x)) - padding, minY: Math.min(...points.map(({ y }) => y)) - padding,
    maxX: Math.max(...points.map(({ x }) => x)) + padding, maxY: Math.max(...points.map(({ y }) => y)) + padding,
  };
}

function frame(bounds, width, height, padding = 0.12) {
  const aspect = width / height;
  const contentWidth = bounds.maxX - bounds.minX; const contentHeight = bounds.maxY - bounds.minY;
  const viewWidth = Math.max(contentWidth * (1 + 2 * padding), contentHeight * (1 + 2 * padding) * aspect);
  const viewHeight = viewWidth / aspect;
  const cx = (bounds.minX + bounds.maxX) / 2; const cy = (bounds.minY + bounds.maxY) / 2;
  return { x: cx - viewWidth / 2, y: cy - viewHeight / 2, width: viewWidth, height: viewHeight };
}

function board(entry, x, y, width, height, fit = true) {
  const { puzzle } = entry; const box = fit
    ? frame(geometryBounds(entry), width, height)
    : frame({ minX: 0, minY: 0, maxX: puzzle.width, maxY: puzzle.height }, width, height, 0.05);
  const paths = [];
  for (let gx = 0; gx <= puzzle.width + 1e-8; gx += 0.5) paths.push(`<path d="M ${gx} 0 V ${puzzle.height}"/>`);
  for (let gy = 0; gy <= puzzle.height + 1e-8; gy += 0.5) paths.push(`<path d="M 0 ${gy} H ${puzzle.width}"/>`);
  const arrows = puzzle.arrows.map((arrow) => {
    const points = arrow.path.map(toBoard); const end = points.at(-1); const previous = points.at(-2);
    const dx = end.x - previous.x; const dy = end.y - previous.y; const length = Math.hypot(dx, dy);
    const ux = dx / length; const uy = dy / length; const px = -uy; const py = ux;
    const tip = { x: end.x + ux * 0.36, y: end.y + uy * 0.36 };
    const base = { x: end.x + ux * 0.07, y: end.y + uy * 0.07 };
    const wingA = { x: base.x + px * 0.17, y: base.y + py * 0.17 };
    const wingB = { x: base.x - px * 0.17, y: base.y - py * 0.17 };
    return `<g><polyline class="arrow" points="${points.map(({ x, y }) => `${x},${y}`).join(' ')}"/><circle class="tail" cx="${points[0].x}" cy="${points[0].y}" r=".09"/><path class="head" d="M ${tip.x} ${tip.y} L ${wingA.x} ${wingA.y} L ${wingB.x} ${wingB.y} Z"/></g>`;
  }).join('');
  return `<svg class="puzzle" x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" aria-label="${esc(entry.name)}: ${puzzle.arrows.length} arrows on a ${puzzle.width} by ${puzzle.height} board"><g class="grid">${paths.join('')}</g>${arrows}</svg>`;
}

const style = `<style>
  text{font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif}.page{fill:#f5f5f2}.title{font-size:23px;font-weight:700;fill:#252a30}.subtitle{font-size:13px;fill:#687078}.name{font-size:17px;font-weight:700;fill:#252a30}.meta{font-size:12px;fill:#646d74}.card{fill:#fff;stroke:#e1e4e0;stroke-width:1.5}.screen{fill:#fbfbf8;stroke:#dfe3df;stroke-width:1.5}.hud{font-size:13px;font-weight:600;fill:#30363d}.quiet{font-size:11px;fill:#778087}.grid path{stroke:#d8ddda;stroke-width:.025;fill:none;opacity:.55}.arrow{fill:none;stroke:#30363d;stroke-width:.12;stroke-linecap:round;stroke-linejoin:round}.tail{fill:#fbfbf8;stroke:#30363d;stroke-width:.025}.head{fill:#30363d}
</style>`;

const letter = (index) => String.fromCharCode(68 + index);
for (const [index, entry] of prototypes.entries()) {
  const name = `Prototype ${letter(index)} — ${entry.name}`;
  const full = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">${style}<rect class="page" width="390" height="844"/><text class="hud" x="22" y="34">ARROW ADVENTURE · QA</text><text class="hud" x="22" y="69">${esc(name)}</text><text class="quiet" x="22" y="91">${entry.puzzle.arrows.length} arrows · ${entry.puzzle.width}×${entry.puzzle.height} · fitted from occupied paths</text><rect class="screen" x="8" y="105" width="374" height="704" rx="16"/><text class="quiet" x="20" y="830">LEVEL ${letter(index)} · 3 ♥ · RESTART</text>${board(entry, 16, 112, 358, 690, true)}</svg>`;
  writeFileSync(resolve(out, `prototype-${letter(index).toLowerCase()}.svg`), full);
}

const cards = prototypes.map((entry, index) => {
  const col = index % 2; const row = Math.floor(index / 2); const x = 20 + col * 560; const y = 90 + row * 520;
  return `<rect class="card" x="${x}" y="${y}" width="540" height="500" rx="14"/><text class="name" x="${x + 18}" y="${y + 30}">Prototype ${letter(index)} — ${esc(entry.name)}</text><text class="meta" x="${x + 18}" y="${y + 52}">${entry.puzzle.arrows.length} arrows · ${entry.puzzle.width}×${entry.puzzle.height} · ${esc(entry.difficulty)}</text>${board(entry, x + 12, y + 66, 516, 414, true)}`;
}).join('');
writeFileSync(resolve(out, 'contact-sheet.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="1140" height="1670" viewBox="0 0 1140 1670">${style}<rect class="page" width="1140" height="1670"/><text class="title" x="20" y="38">Arrow Adventure — Round 9D composition review</text><text class="subtitle" x="20" y="62">Five original QA experiments · exact paths · thin monochrome styling · fitted to each composition</text>${cards}</svg>`);

const comparisons = ['Micro-Arrow Field', 'Large Mixed-Length Weave'].map((name, panelIndex) => {
  const entry = prototypes.find(({ name: candidate }) => candidate === name);
  const x = 20 + panelIndex * 790;
  return `<rect class="card" x="${x}" y="90" width="760" height="790" rx="15"/><text class="name" x="${x + 18}" y="124">${esc(name)} · ${entry.puzzle.arrows.length} arrows</text><text class="meta" x="${x + 18}" y="150">Before: logical board bounds</text><text class="meta" x="${x + 398}" y="150">After: occupied composition bounds</text>${board(entry, x + 12, 165, 360, 690, false)}${board(entry, x + 390, 165, 360, 690, true)}<rect class="screen" x="${x + 12}" y="165" width="360" height="690" fill="none"/><rect class="screen" x="${x + 390}" y="165" width="360" height="690" fill="none"/>`;
}).join('');
writeFileSync(resolve(out, 'fit-comparison.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="920" viewBox="0 0 1600 920">${style}<rect class="page" width="1600" height="920"/><text class="title" x="20" y="38">Automatic fit-to-composition comparison</text><text class="subtitle" x="20" y="62">Fixed logical board frame vs. occupied arrows, in a portrait phone viewport</text>${comparisons}</svg>`);
console.log(`Rendered five phone previews, a contact sheet, and two fit comparisons in ${out}`);
