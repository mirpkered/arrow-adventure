import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const root = process.cwd();
const outputDirectory = `${root}/docs/previews/round-13-large-grid`;
mkdirSync(outputDirectory, { recursive: true });
const catalog = JSON.parse(readFileSync(`${root}/src/game/adventure-catalog.json`, 'utf8'));
const server = await createServer({ configFile: './vite.config.ts', server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'silent' });
let measures;
try {
  const { analyzeLevel } = await server.ssrLoadModule('/src/game/rules.ts');
  const density = await server.ssrLoadModule('/src/game/density.ts');
  measures = new Map(catalog.levels.map((entry) => [entry.number, {
    ...analyzeLevel(entry.puzzle),
    routeUnits: analyzeLevel(entry.puzzle).pathLengths.reduce((sum, length) => sum + length, 0),
    adjacentCoverage: density.measureComposition(entry.puzzle, 1.01).adjacentGridPathRatio,
    largeGapRatio: density.measureFootprintDensity(entry).largeGapRatio,
  }]));
} finally { await server.close(); }

for (const entry of catalog.levels.filter((item) => item.number >= 6)) {
  const number = entry.number;
  const report = measures.get(number);
  const prefix = `level-${number}`;
  writeFileSync(`${outputDirectory}/${prefix}-full.svg`, renderBoard(entry, 1000, 860, { heading: `LEVEL ${number} — ${entry.title}`, subtitle: `${entry.puzzle.width}×${entry.puzzle.height} visible cells · ${entry.puzzle.arrows.length} arrows` }));
  writeFileSync(`${outputDirectory}/${prefix}-iphone-390x844.svg`, renderPhone(entry));
  writeFileSync(`${outputDirectory}/${prefix}-arrow-ids.svg`, renderBoard(entry, 1100, 900, { ids: true, heading: `LEVEL ${number} — ARROW IDS`, subtitle: 'Frozen route geometry · IDs positioned on actual paths' }));
  writeFileSync(`${outputDirectory}/${prefix}-grid-coverage.svg`, renderBoard(entry, 1100, 900, { grid: true, coverage: true, coordinates: true, heading: `LEVEL ${number} — GRID / ROUTE COVERAGE`, subtitle: 'Every displayed intersection occupied · circles mark authored route vertices' }));
  writeFileSync(`${outputDirectory}/${prefix}-density-summary.svg`, renderDensityComparison(catalog.levels[number - 2], entry, measures.get(number - 1), report));
}
writeFileSync(`${outputDirectory}/contact-sheet.svg`, renderContactSheet(catalog.levels, measures));
writeFileSync(`${outputDirectory}/README.md`, reportMarkdown(catalog.levels.filter(({ number }) => number >= 6), measures, catalog.levels.length));

function renderContactSheet(entries, allMeasures) {
  const width = 1320; const height = 3 * 440 + 100; const cardW = 400; const cardH = 420; const gap = 28;
  const cards = entries.map((entry, index) => {
    const x = 32 + (index % 3) * (cardW + gap); const y = 80 + Math.floor(index / 3) * cardH;
    const board = boardGroup(entry.puzzle, { x: x + 34, y: y + 86, width: cardW - 68, height: 260 }, { grid: true });
    return `<g><rect x="${x}" y="${y}" width="${cardW}" height="${cardH - 18}" rx="18" fill="#fff" stroke="#e4e4df"/><text x="${x + 20}" y="${y + 29}" class="title">${esc(`LEVEL ${entry.number} · ${entry.title}`)}</text><text x="${x + 20}" y="${y + 51}" class="meta">${entry.puzzle.width}×${entry.puzzle.height} visible cells · ${entry.puzzle.arrows.length} arrows · ${allMeasures.get(entry.number).routeUnits} route units</text>${board}<text x="${x + 20}" y="${y + 386}" class="small">${entry.id} · content v${entry.contentVersion}</text></g>`;
  }).join('');
  return svg(width, height, `<text x="40" y="42" class="heading">ARROW ADVENTURE · ROUND 13 LARGE-GRID CONTACT SHEET</text>${cards}`);
}

function renderBoard(entry, width, height, options = {}) {
  const top = options.heading ? 92 : 20;
  const board = boardGroup(entry.puzzle, { x: 40, y: top, width: width - 80, height: height - top - 28 }, options);
  const heading = options.heading ? `<text x="32" y="38" class="heading">${esc(options.heading)}</text><text x="32" y="63" class="meta">${esc(options.subtitle ?? '')}</text>` : '';
  return svg(width, height, `${heading}${board}`);
}

function renderPhone(entry) {
  const width = 390; const height = 844;
  const bounds = fit(entry.puzzle, 390, 622);
  const hud = `<rect width="390" height="844" fill="#f7f7f2"/><text x="30" y="34" class="micro">MIRPWORKS</text><text x="354" y="34" text-anchor="end" class="micro">PREVIEW</text><rect x="0" y="52" width="390" height="58" fill="#f7f7f2" stroke="#e5e6e0"/><text x="20" y="86" class="hudlevel">LEVEL ${entry.number}</text><text x="182" y="86" text-anchor="middle" class="hearts">♥ ♥ ♥</text><circle cx="314" cy="81" r="17" fill="#eeefe9"/><path d="M 314 72 V 82 L 320 86" stroke="#30373e" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="360" cy="81" r="17" fill="#eeefe9"/><path d="M 354 75 H 366 V 87 H 354 Z M 357 72 V 90 M 363 72 V 90" stroke="#30373e" stroke-width="1.5" fill="none"/><text x="195" y="132" text-anchor="middle" class="hint">Find an arrow with a clear path out.</text><rect x="0" y="146" width="390" height="622" fill="#f7f7f2"/>${boardGroup(entry.puzzle, { x: 0, y: 146, width, height: 622 }, { grid: true })}<rect x="0" y="768" width="390" height="42" fill="#f7f7f2"/><text x="18" y="794" class="footer">${entry.puzzle.arrows.length} arrows remaining</text><text x="372" y="794" text-anchor="end" class="footer">${entry.number} / ${catalog.levels.length}</text><text x="195" y="831" text-anchor="middle" class="micro">STATIC RENDERER PREVIEW · NOT A SAFARI SCREENSHOT</text>`;
  return svg(width, height, hud);
}

function renderDensityComparison(previous, current, prevMetrics, currentMetrics) {
  const width = 1160; const height = 730; const boardWidth = 490;
  const left = boardGroup(previous.puzzle, { x: 38, y: 116, width: boardWidth, height: 430 }, { grid: true });
  const right = boardGroup(current.puzzle, { x: 632, y: 116, width: boardWidth, height: 430 }, { grid: true });
  const rows = [
    ['Visible grid', `${previous.puzzle.width}×${previous.puzzle.height}`, `${current.puzzle.width}×${current.puzzle.height}`],
    ['Arrows', previous.puzzle.arrows.length, current.puzzle.arrows.length],
    ['Route units', prevMetrics.routeUnits, currentMetrics.routeUnits],
    ['Adjacent-grid coverage', pct(prevMetrics.adjacentCoverage), pct(currentMetrics.adjacentCoverage)],
    ['Interleaved arrow pairs', prevMetrics.interleavedPairs, currentMetrics.interleavedPairs],
    ['Blocking links / depth', `${prevMetrics.blockingDependencies} / ${prevMetrics.dependencyDepth}`, `${currentMetrics.blockingDependencies} / ${currentMetrics.dependencyDepth}`],
    ['Initial legal moves', prevMetrics.initiallyRemovable, currentMetrics.initiallyRemovable],
    ['Large-gap ratio', pct(prevMetrics.largeGapRatio), pct(currentMetrics.largeGapRatio)],
  ];
  const textRows = rows.map(([label, before, after], index) => `<text x="170" y="${568 + index * 19}" class="small">${esc(String(label))}</text><text x="495" y="${568 + index * 19}" class="small" text-anchor="end">${esc(String(before))}</text><text x="1115" y="${568 + index * 19}" class="small" text-anchor="end">${esc(String(after))}</text>`).join('');
  return svg(width, height, `<text x="32" y="40" class="heading">DENSITY COMPARISON · ${current.number - 1} → ${current.number}</text><text x="283" y="82" class="title" text-anchor="middle">${previous.puzzle.width}×${previous.puzzle.height} · ${previous.puzzle.arrows.length} arrows</text><text x="877" y="82" class="title" text-anchor="middle">${current.puzzle.width}×${current.puzzle.height} · ${current.puzzle.arrows.length} arrows</text>${left}${right}<path d="M 32 554 H 1128" stroke="#dedfd9"/>${textRows}`);
}

function boardGroup(level, rect, options = {}) {
  const box = fit(level, rect.width, rect.height, options);
  const x = rect.x; const y = rect.y; const width = rect.width; const height = rect.height;
  const viewBox = `${box.x} ${box.y} ${box.width} ${box.height}`;
  const grid = options.grid ? gridMarkup(level.width, level.height) : '';
  const arrows = level.arrows.map((arrow) => {
    const points = arrow.path.map((point) => ({ x: point.x + level.grid.pathOffset, y: point.y + level.grid.pathOffset }));
    const string = points.map(({ x: px, y: py }) => `${px},${py}`).join(' ');
    const [tip, a, b] = headTriangle(arrow.path, level.grid.pathOffset);
    const tail = points[0];
    const idPoint = points[Math.floor(points.length / 2)];
    const idLabel = options.ids ? `<text class="arrowid" x="${idPoint.x}" y="${idPoint.y - .17}" text-anchor="middle">${esc(arrow.id)}</text>` : '';
    const marks = options.coverage ? points.map(({ x: px, y: py }) => `<circle cx="${px}" cy="${py}" r=".055" fill="#d6a844" stroke="#f7f7f2" stroke-width=".025"/>`).join('') : '';
    return `<g><polyline points="${string}" fill="none" stroke="#30373e" stroke-width=".12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${tail.x}" cy="${tail.y}" r=".09" fill="#f7f7f2" stroke="#30373e" stroke-width=".025"/><path d="M ${tip.x} ${tip.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z" fill="#30373e" stroke="#f7f7f2" stroke-width=".025" stroke-linejoin="round"/>${marks}${idLabel}</g>`;
  }).join('');
  const coordinates = options.coordinates ? coordinateLabels(level) : '';
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="img">${grid}${arrows}${coordinates}</svg>`;
}

function fit(level, pixelWidth, pixelHeight, options = {}) {
  const points = level.arrows.flatMap((arrow) => arrow.path.map((point) => ({ x: point.x + level.grid.pathOffset, y: point.y + level.grid.pathOffset })));
  const heads = level.arrows.flatMap((arrow) => headTriangle(arrow.path, level.grid.pathOffset));
  const tails = level.arrows.flatMap((arrow) => {
    const point = { x: arrow.path[0].x + level.grid.pathOffset, y: arrow.path[0].y + level.grid.pathOffset };
    return [{ x: point.x - .09, y: point.y - .09 }, { x: point.x + .09, y: point.y + .09 }];
  });
  const content = [...points, ...heads, ...tails]; const padding = .06;
  const coordinateMargin = options.coordinates ? .28 : 0;
  const minX = Math.min(...content.map(({ x }) => x)) - padding - coordinateMargin;
  const minY = Math.min(...content.map(({ y }) => y)) - padding - coordinateMargin;
  const maxX = Math.max(...content.map(({ x }) => x)) + padding + coordinateMargin;
  const maxY = Math.max(...content.map(({ y }) => y)) + padding + coordinateMargin;
  const paddedWidth = (maxX - minX) * 1.24; const paddedHeight = (maxY - minY) * 1.24;
  const aspect = pixelWidth / pixelHeight;
  const width = Math.max(paddedWidth, paddedHeight * aspect); const height = width / aspect;
  const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2;
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

function gridMarkup(width, height) {
  const lines = [];
  for (let x = 0; x <= width; x += 1) lines.push(`<path d="M ${x} 0 V ${height}"/>`);
  for (let y = 0; y <= height; y += 1) lines.push(`<path d="M 0 ${y} H ${width}"/>`);
  return `<g fill="none" stroke="#e2e3dc" stroke-width=".018" opacity=".72">${lines.join('')}</g>`;
}

function coordinateLabels(level) {
  const labels = [];
  for (let x = 0; x <= level.width; x += 1) labels.push(`<text class="coord" x="${x}" y="-.17" text-anchor="middle">${x}</text>`);
  for (let y = 0; y <= level.height; y += 1) labels.push(`<text class="coord" x="-.2" y="${y + .04}" text-anchor="end">${y}</text>`);
  return `<g>${labels.join('')}</g>`;
}

function headTriangle(path, offset) {
  const head = path.at(-1); const previous = path.at(-2);
  const dx = head.x - previous.x; const dy = head.y - previous.y; const length = Math.hypot(dx, dy);
  const ux = dx / length; const uy = dy / length; const px = -uy; const py = ux;
  const center = { x: head.x + offset, y: head.y + offset };
  const tip = { x: center.x + ux * .36, y: center.y + uy * .36 };
  const base = { x: center.x + ux * .07, y: center.y + uy * .07 };
  return [tip, { x: base.x + px * .17, y: base.y + py * .17 }, { x: base.x - px * .17, y: base.y - py * .17 }];
}

function svg(width, height, content, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ${extra} viewBox="0 0 ${width} ${height}"><style>text{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;fill:#20272e}.heading{font-size:23px;font-weight:700;letter-spacing:.04em}.title{font-size:16px;font-weight:650}.meta{font-size:12px;fill:#687175}.small{font-size:11px;fill:#687175}.micro{font-size:9px;letter-spacing:.14em;fill:#80898d}.hudlevel{font-size:18px;font-weight:600}.hearts{font-size:21px;fill:#d96662;letter-spacing:2px}.hint{font-size:12px;fill:#7f888b}.footer{font-size:11px;fill:#7f888b}.arrowid{font-family:ui-monospace,monospace;font-size:.22px;font-weight:700;fill:#9c6021;paint-order:stroke;stroke:#f7f7f2;stroke-width:.05}.coord{font-family:ui-monospace,monospace;font-size:.14px;fill:#ac5b42}</style><rect width="100%" height="100%" fill="#f7f7f2"/>${content}</svg>`;
}

function reportMarkdown(newLevels, allMeasures, catalogLength) {
  const rows = newLevels.map((entry) => {
    const m = allMeasures.get(entry.number);
    const base = `./level-${entry.number}`;
    return `### Level ${entry.number} — ${entry.title}\n\n${entry.puzzle.width}×${entry.puzzle.height} visible cells · ${entry.puzzle.arrows.length} arrows · ${m.routeUnits} route units · IDs ${entry.id} · content v${entry.contentVersion} · seed ${entry.authoringSeed}.\n\n- [Full-board preview](${base}-full.svg) · [PNG](${base}-full.png)\n- [390×844 portrait preview](${base}-iphone-390x844.svg) · [PNG](${base}-iphone-390x844.png)\n- [Arrow-ID diagnostic](${base}-arrow-ids.svg) · [PNG](${base}-arrow-ids.png)\n- [Grid and route-coverage diagnostic](${base}-grid-coverage.svg) · [PNG](${base}-grid-coverage.png)\n- [Density comparison with Level ${entry.number - 1}](${base}-density-summary.svg) · [PNG](${base}-density-summary.png)\n\n**Composition:** ${m.interleavedPairs} interleaved pairs; ${m.closeSegmentContacts} close segment contacts; ${m.blockingDependencies} blocking links; dependency depth ${m.dependencyDepth}; ${m.initiallyRemovable} initial legal moves; ${(m.adjacentCoverage * 100).toFixed(1)}% adjacent-grid path coverage; ${(m.largeGapRatio * 100).toFixed(2)}% large-gap area.\n`;
  }).join('\n');
  return `# Round 13 Large-Grid Previews\n\nThese are static SVG renders of the exact frozen catalog coordinates using Arrow Adventure's light palette, visible unit grid, 0.12-unit arrow body, arrowhead geometry, and tail marker. Phone previews are fitted to a 390×622 play area inside a 390×844 portrait mock viewport using the same occupied-bounds fit calculation as the BoardViewport class; they are renderer previews, not Safari captures or physical-device screenshots. PNGs are derived from these SVGs.\n\n[${catalogLength}-level campaign contact sheet](./contact-sheet.svg) · [PNG](./contact-sheet.png)\n\n${rows}`;
}
function pct(value) { return `${(value * 100).toFixed(value < .01 ? 2 : 1)}%`; }
function esc(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
