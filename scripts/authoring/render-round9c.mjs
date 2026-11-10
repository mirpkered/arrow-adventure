import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const prototypes = JSON.parse(readFileSync(resolve(root, 'src/game/prototypes/round9c-prototypes.json'), 'utf8'));
const out = resolve(root, 'docs/previews/round-9c');
mkdirSync(out, { recursive: true });

function svgHeader(title, subtitle, width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>text{font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}.grid path{stroke:#dfe2e0;stroke-width:.018;fill:none}.board{fill:#fbfbf8;stroke:#e6e8e5;stroke-width:.04}.body{fill:none;stroke:#30363d;stroke-width:.12;stroke-linecap:round;stroke-linejoin:round}.tail{fill:#fbfbf8;stroke:#30363d;stroke-width:.025}.head{fill:#30363d}.title{font-size:22px;font-weight:700;fill:#252a30}.subtitle{font-size:13px;fill:#687078}.card{fill:#fff;stroke:#e2e5e2;stroke-width:1.5}.small{font-size:12px;fill:#687078}</style><rect width="100%" height="100%" fill="#f3f4f1"/><text class="title" x="28" y="38">${escapeXml(title)}</text><text class="subtitle" x="28" y="61">${escapeXml(subtitle)}</text>`;
}
function escapeXml(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function wrapWords(value, maxCharacters = 64) {
  const lines = [];
  let line = '';
  for (const word of String(value).split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxCharacters && line) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}
function board(entry, x, y, boxW, boxH, label=true) {
  const { puzzle } = entry; const boardW = puzzle.width + 1; const boardH = puzzle.height + 1;
  const scale = Math.min(boxW / boardW, boxH / boardH); const width = boardW * scale; const height = boardH * scale;
  const ox = x + (boxW-width)/2; const oy = y + (boxH-height)/2;
  const grid=[];
  for(let gx=0;gx<=puzzle.width;gx+=.5) grid.push(`<path d="M${gx},0V${puzzle.height}"/>`);
  for(let gy=0;gy<=puzzle.height;gy+=.5) grid.push(`<path d="M0,${gy}H${puzzle.width}"/>`);
  const arrows=puzzle.arrows.map((arrow,index)=>{
    const pts=arrow.path.map(({x,y})=>({x:x+.5,y:y+.5}));
    const points=pts.map(({x,y})=>`${x},${y}`).join(' '); const end=pts.at(-1),prev=pts.at(-2);
    const dx=end.x-prev.x,dy=end.y-prev.y,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,px=-uy,py=ux;
    const tip=[end.x+ux*.36,end.y+uy*.36],base=[end.x+ux*.07,end.y+uy*.07];
    const one=[base[0]+px*.17,base[1]+py*.17],two=[base[0]-px*.17,base[1]-py*.17];
    return `<g><polyline class="body" points="${points}"/><circle class="tail" cx="${pts[0].x}" cy="${pts[0].y}" r=".09"/><path class="head" d="M${tip[0]},${tip[1]}L${one[0]},${one[1]}L${two[0]},${two[1]}Z"/>${label?`<text x="${pts[0].x+.1}" y="${pts[0].y-.1}" font-size=".28" fill="#8b4d2c">${index+1}</text>`:''}</g>`;
  }).join('');
  return `<g transform="translate(${ox} ${oy}) scale(${scale})"><rect class="board" x="0" y="0" width="${puzzle.width}" height="${puzzle.height}" rx=".12"/><g class="grid">${grid.join('')}</g>${arrows}</g>`;
}
const cards=[];
for(const [index,entry] of prototypes.entries()){
  const number=index+1, col=index%3, x=20+col*520, y=92;
  const caption = wrapWords(entry.previewCaption ?? entry.purpose, 60).slice(0, 2).map((line, lineIndex) => `<text class="small" x="${x+18}" y="${y+632+lineIndex*17}">${escapeXml(line)}</text>`).join('');
  cards.push(`<rect class="card" x="${x}" y="${y}" width="500" height="675" rx="16"/><text class="title" x="${x+18}" y="${y+32}">Prototype ${String.fromCharCode(65+index)} — ${escapeXml(entry.name)}</text><text class="small" x="${x+18}" y="${y+54}">${entry.puzzle.arrows.length} arrows · ${entry.puzzle.width}×${entry.puzzle.height} · ${escapeXml(entry.difficulty)}</text>${board(entry,x+22,y+72,456,540,false)}${caption}`);
  const full=`${svgHeader(`Prototype ${String.fromCharCode(65+index)} — ${entry.name}`,`${entry.puzzle.arrows.length} arrows · ${entry.puzzle.width}×${entry.puzzle.height} · ${entry.difficulty}`,780,1000)}${board(entry,32,86,716,860,false)}</svg>`;
  writeFileSync(resolve(out,`prototype-${String.fromCharCode(97+index)}.svg`),full);
}
const sheet=`${svgHeader('Arrow Adventure — Round 9C composition review','Three experimental layouts · exact puzzle paths · monochrome game rendering',1600,800)}${cards.join('')}</svg>`;
writeFileSync(resolve(out,'contact-sheet.svg'),sheet);

const heart=prototypes[1];
const heartOutline='<path d="M110 190 C60 130 20 100 20 55 C20 12 82 0 110 42 C138 0 200 12 200 55 C200 100 160 130 110 190Z" fill="#cf6d76" fill-opacity=".1" stroke="#cf6d76" stroke-width="3"/>';
const comparison=`${svgHeader('Heart prototype — intended composition and arrow result','Comparison only · the right panel renders the playable arrow paths without an outline',1200,700)}<rect class="card" x="20" y="90" width="560" height="570" rx="16"/><rect class="card" x="600" y="90" width="580" height="570" rx="16"/><text class="title" x="45" y="130">Composition target</text><text class="title" x="625" y="130">Playable arrow paths</text><g transform="translate(170 205) scale(1.4)">${heartOutline}</g>${board(heart,635,155,510,470,false)}</svg>`;
writeFileSync(resolve(out,'heart-comparison.svg'),comparison);
console.log(`Rendered ${prototypes.length} individual SVGs, a contact sheet, and a heart comparison in ${out}`);
