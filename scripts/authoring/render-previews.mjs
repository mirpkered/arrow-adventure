import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const previews = [];
for (let number = 1; number <= 10; number += 1) {
  const entry = JSON.parse(readFileSync(resolve(root, `scripts/authoring/level${String(number).padStart(2, '0')}.json`), 'utf8'));
  const { level, footprint, meta } = entry;
  const lines = [];
  for (let x = 0.5; x <= level.width; x += 0.5) lines.push(`<path d="M${x} 0V${level.height}"/>`);
  for (let y = 0.5; y <= level.height; y += 0.5) lines.push(`<path d="M0 ${y}H${level.width}"/>`);
  const shapes = level.arrows.map((arrow) => {
    const path = arrow.path.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 }));
    const end = path.at(-1); const prev = path.at(-2);
    const dx = end.x - prev.x; const dy = end.y - prev.y; const length = Math.hypot(dx, dy);
    const ux = dx / length; const uy = dy / length; const px = -uy; const py = ux;
    const tip = { x: end.x + ux * 0.36, y: end.y + uy * 0.36 };
    const base = { x: end.x + ux * 0.07, y: end.y + uy * 0.07 };
    const wingA = { x: base.x + px * 0.18, y: base.y + py * 0.18 };
    const wingB = { x: base.x - px * 0.18, y: base.y - py * 0.18 };
    return `<g><polyline points="${path.map(({ x, y }) => `${x},${y}`).join(' ')}"/><circle cx="${path[0].x}" cy="${path[0].y}" r=".09"/><path d="M${tip.x},${tip.y}L${wingA.x},${wingA.y}L${wingB.x},${wingB.y}Z"/></g>`;
  }).join('');
  const polygons = footprint.map((polygon) => `<polygon points="${polygon.map(({ x, y }) => `${x + 0.5},${y + 0.5}`).join(' ')}"/>`).join('');
  previews.push(`<article><header><strong>LEVEL ${number}</strong><span>${level.arrows.length} arrows · ${meta.analyze.dependencyDepth} dependency waves</span></header><svg viewBox="0 0 ${level.width + 1} ${level.height + 1}" role="img" aria-label="Level ${number} starting puzzle"><g class="grid">${lines.join('')}</g><g class="footprint">${polygons}</g><g class="arrows">${shapes}</g></svg><footer>Inside-footprint large gaps ${Math.round(meta.density.largeGapRatio * 1000) / 10}% · interleaved ${meta.analyze.interleavedPairs} · safe starts ${meta.analyze.initiallyRemovable}</footer></article>`);
}

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Round 9 — Level candidates</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#f7f7f2;color:#20272e;font:14px system-ui,sans-serif}h1{font-size:24px;margin:0 0 7px}p{margin:0 0 18px;color:#666}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:15px}article{min-width:0;background:#fff;border:1px solid #e5e6e0;border-radius:16px;padding:12px;display:grid;grid-template-rows:auto minmax(220px,1fr) auto;gap:8px}header,footer{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:12px;color:#777}header strong{color:#20272e;letter-spacing:.08em}svg{width:100%;height:min(58vh,390px);min-height:220px;background:#fafaf7;border-radius:9px}.grid path{stroke:#e5e6e0;stroke-width:.018;fill:none}.footprint polygon{fill:#d6a83b18;stroke:#b68733;stroke-width:.055;stroke-dasharray:.14 .1;display:none}body.show-footprint .footprint polygon{display:block}.arrows polyline{fill:none;stroke:#30373e;stroke-width:.12;stroke-linecap:round;stroke-linejoin:round}.arrows circle{fill:#fafaf7;stroke:#30373e;stroke-width:.025}.arrows path{fill:#30373e}
</style><h1>Round 9 candidate compositions</h1><p>Frozen authoring candidates shown without footprint overlay. Use browser zoom to review; dotted masks can be enabled by appending <code>#footprints</code>.</p><main>${previews.join('')}</main><script>if(location.hash==='#footprints')document.body.classList.add('show-footprint')</script></html>`;
writeFileSync(resolve(root, 'docs/previews/round-9-candidates.html'), html);
