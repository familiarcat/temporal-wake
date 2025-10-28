import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import fs from 'node:fs/promises';
import path from 'node:path';
import panzoom from 'panzoom';

type Doc = { id: 'screenplay'|'novel'|'outline'; title: string; path: string };
const docs: Doc[] = [
  { id: 'screenplay', title: 'Screenplay', path: path.join(process.cwd(), '..', 'temporal_wake_screenplay.md') },
  { id: 'novel', title: 'Novel', path: path.join(process.cwd(), '..', 'temporal_wake_novel.md') },
  { id: 'outline', title: 'Outline', path: path.join(process.cwd(), '..', 'temporal_wake_outline.md') },
];

function extractTimelineGraph(md: string) {
  // Minimal, ASCII-only timeline visualization (launch -> arrival)
  type Crew = { name: string; role: string; leader?: boolean };
  type Ship = { mission: string; launch: number; vector: 'military'|'science'|'colony'; crew: Crew[] };
  const ships: Record<string, Ship> = {
    'Ares Prime': { mission: 'Claim strength -> mediate peace', launch: 2087, vector: 'military', crew: [ { name: 'VASQUEZ', role: 'Admiral', leader: true } ] },
    'Guardian Sentinel': { mission: 'Protect colonies; peacekeeping', launch: 2089, vector: 'military', crew: [ { name: 'PARK', role: 'Colonel', leader: true } ] },
    'Prometheus Array': { mission: 'Map temporal wake; restraint', launch: 2103, vector: 'science', crew: [ { name: 'AL-HAMADI', role: 'Lead Physicist', leader: true } ] },
    'Odyssey Venture': { mission: 'Explore; understand; diplomacy-first', launch: 2134, vector: 'science', crew: [ { name: 'KAITO', role: 'Captain', leader: true } ] },
    'Celestial Bloom': { mission: 'Build a home; open colony', launch: 2156, vector: 'colony', crew: [ { name: 'CHEN', role: 'Commander', leader: true } ] },
  };

  function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function deriveLaunch(mdText: string, shipName: string, fallback: number) {
    const esc = escapeReg(shipName);
    const patterns = [
      new RegExp(`${esc}\\s*-\\s*Earth\\s+Year\\s+(\\d{4})`, 'i'),
      new RegExp(`${esc}[^\n]*\\((\\d{4})\\)`, 'i'),
      new RegExp(`${esc}[^\n]*\\blaunch(?:ed)?\\s+(\\d{4})`, 'i'),
    ];
    for (const re of patterns) {
      const m = mdText.match(re);
      if (m && m[1]) return parseInt(m[1], 10);
    }
    return fallback;
  }

  const shipsWithDerivedLaunch: Record<string, Ship> = Object.fromEntries(
    Object.entries(ships).map(([name, meta]) => [
      name,
      { ...meta, launch: deriveLaunch(md, name, meta.launch) },
    ]),
  ) as Record<string, Ship>;

  let g = 'graph LR\n';
  // Basic styles
  g += 'classDef header fill:#111827,stroke:#374151,color:#fff,stroke-width:2px\n';
  g += 'classDef event fill:#fff7ed,stroke:#c2410c,color:#111,stroke-dasharray: 2 2\n';

  // Order by launch
  const ordered = Object.entries(shipsWithDerivedLaunch).sort((a,b) => a[1].launch - b[1].launch);
  const id = (s: string) => s.replace(/[^A-Za-z0-9]/g,'');
  const L = (s: string) => `${id(s)}L`;
  const A = (s: string) => `${id(s)}A`;

  // Launch lane
  g += 'subgraph Launches[Launch Timeline]\n';
  g += 'direction LR\n';
  for (const [ship, meta] of ordered) {
    g += `${L(ship)}["${ship} (${meta.launch})"]:::header\n`;
  }
  g += 'end\n';

  // Arrival lane (fixed narrative order for readability)
  const arrivalOrder = ['Prometheus Array','Ares Prime','Guardian Sentinel','Odyssey Venture','Celestial Bloom'];
  g += 'subgraph Arrivals[Kepler 442 Arrival]\n';
  g += 'direction LR\n';
  for (const ship of arrivalOrder) {
    g += `${A(ship)}["${ship} (arrival)"]:::header\n`;
  }
  g += 'end\n';

  // Displacement edges
  for (const [ship] of ordered) g += `${L(ship)}-.->${A(ship)}\n`;

  // Connect arrival nodes left-to-right for flow
  for (let i = 0; i < arrivalOrder.length - 1; i++) {
    g += `${A(arrivalOrder[i])}-->${A(arrivalOrder[i+1])}\n`;
  }

  return g;
}

export default function MermaidTimelinePage({ combined }: { combined: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');
  const panInstance = useRef<ReturnType<typeof panzoom> | null>(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
    const graph = extractTimelineGraph(combined);
    mermaid.render('mmdTimeline', graph).then(({ svg }) => setSvg(svg)).catch((e) => setSvg(`<pre>${String(e)}</pre>`));
  }, [combined]);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    panInstance.current?.dispose?.();
    panInstance.current = panzoom(svgEl as SVGSVGElement, { maxZoom: 3, minZoom: 0.2, smoothScroll: false, bounds: false, zoomDoubleClickSpeed: 1 });
    return () => { panInstance.current?.dispose?.(); panInstance.current = null; };
  }, [svg]);

  return (
    <main className="container">
      <h1>Character / Ship Map — Timeline</h1>
      <div className="no-print" style={{display:'flex', gap:8, marginBottom:8}}>
        <button onClick={() => panInstance.current?.zoomTo(0,0, 1.1)}>+</button>
        <button onClick={() => panInstance.current?.zoomTo(0,0, 0.9)}>-</button>
        <button onClick={() => panInstance.current?.moveTo(0,0)}>Reset</button>
      </div>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: svg }} style={{border:'1px solid #e5e7eb', overflow:'hidden'}} />
      <p className="no-print" style={{marginTop:'1rem'}}>This timeline shows launch chronology (top) and arrival ordering at Kepler 442 (bottom). Dotted edges indicate temporal displacement.</p>
    </main>
  );
}

export async function getServerSideProps() {
  const entries = await Promise.all(docs.map(async d => ({ id: d.id, text: await fs.readFile(d.path, 'utf8').catch(() => '') })));
  const texts = entries.reduce((acc, e) => { (acc as any)[e.id] = e.text; return acc; }, {} as Record<'screenplay'|'novel'|'outline', string>);
  return { props: { combined: Object.values(texts).join('\n\n') } };
}


