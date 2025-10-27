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

function extractGraph(md: string) {
  // Ships with mission headers, vector type, and hierarchical crew
  type Crew = { name: string; role: string; leader?: boolean };
  type Ship = { mission: string; launch: number; vector: 'military'|'science'|'colony'; crew: Crew[] };
  const ships: Record<string, Ship> = {
    'Ares Prime': {
      mission: 'Claim strength → mediate peace',
      launch: 2087,
      vector: 'military',
      crew: [
        { name: 'VASQUEZ', role: 'Admiral / Commander', leader: true },
        { name: 'WEBB', role: 'Physicist → Redemption' },
        { name: 'HAYES', role: 'XO / Operations' }
      ]
    },
    'Guardian Sentinel': {
      mission: 'Protect colonies; peacekeeping',
      launch: 2089,
      vector: 'military',
      crew: [
        { name: 'PARK', role: 'Colonel / Command', leader: true },
        { name: 'REEVES', role: 'Major / Tactics' },
        { name: 'OSEI', role: 'Chaplain / Ethics' }
      ]
    },
    'Odyssey Venture': {
      mission: 'Explore; understand; diplomacy-first',
      launch: 2134,
      vector: 'science',
      crew: [
        { name: 'KAITO', role: 'Captain / Scientist', leader: true },
        { name: 'OKONKWO', role: 'Chief Engineer' },
        { name: 'VENKATARAMAN', role: 'First Contact' }
      ]
    },
    'Celestial Bloom': {
      mission: 'Build a home; open colony',
      launch: 2156,
      vector: 'colony',
      crew: [
        { name: 'CHEN', role: 'Commander', leader: true },
        { name: 'HARTMANN', role: 'Botanist / Historian' },
        { name: 'MALIK', role: 'Chief Medical Officer' }
      ]
    },
    'Prometheus Array': {
      mission: 'Map temporal wake; restraint',
      launch: 2103,
      vector: 'science',
      crew: [
        { name: 'AL-HAMADI', role: 'Lead Physicist', leader: true },
        { name: 'TCHAIKOVSKY', role: 'Navigator' },
        { name: 'SATO', role: 'AI Ethics' }
      ]
    }
  };

  // Derive launch years dynamically from markdown (fallback to defaults)
  function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function deriveLaunch(mdText: string, shipName: string, fallback: number) {
    const esc = escapeReg(shipName);
    const patterns = [
      new RegExp(`${esc}\\s*-\\s*Earth\\s+Year\\s+(\\d{4})`, 'i'), // "Ares Prime - Earth Year 2087"
      new RegExp(`${esc}[^\n]*\\((\\d{4})\\)`, 'i'),               // "Ares Prime (2087)"
      new RegExp(`${esc}[^\n]*\\blaunch(?:ed)?\\s+(\\d{4})`, 'i'),  // "Ares Prime, launched 2087"
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

  // Build Mermaid graph
  let g = 'graph LR\n';
  // Ship header (political/temporal status) and crew (equal roles) color classes
  g += 'classDef aresHeader fill:#7f1d1d,stroke:#b91c1c,color:#fff,stroke-width:3px\n';
  g += 'classDef aresCrew fill:#fecaca,stroke:#b91c1c,color:#111\n';
  g += 'classDef guardianHeader fill:#0f5132,stroke:#0f5132,color:#fff,stroke-width:3px\n';
  g += 'classDef guardianCrew fill:#d1e7dd,stroke:#0f5132,color:#111\n';
  g += 'classDef odysseyHeader fill:#084298,stroke:#084298,color:#fff,stroke-width:3px\n';
  g += 'classDef odysseyCrew fill:#e7f1ff,stroke:#084298,color:#111\n';
  g += 'classDef bloomHeader fill:#2d6a4f,stroke:#2d6a4f,color:#fff,stroke-width:3px\n';
  g += 'classDef bloomCrew fill:#eaf4e0,stroke:#2d6a4f,color:#111\n';
  g += 'classDef promHeader fill:#5a189a,stroke:#5a189a,color:#fff,stroke-width:3px\n';
  g += 'classDef promCrew fill:#efeafe,stroke:#5a189a,color:#111\n';
  // Lane visuals (nested subgraphs): command / operations / science
  const laneCmdStyle = 'fill:#fff5f5,stroke:#fecaca,color:#111,stroke-dasharray: 3 3';
  const laneOpsStyle = 'fill:#f8fafc,stroke:#e2e8f0,color:#111,stroke-dasharray: 3 3';
  const laneSciStyle = 'fill:#f3f4f6,stroke:#e5e7eb,color:#111,stroke-dasharray: 3 3';
  // Vector badges
  g += 'classDef vectorMil fill:#b91c1c,stroke:#7f1d1d,color:#fff\n';
  g += 'classDef vectorSci fill:#2563eb,stroke:#1d4ed8,color:#fff\n';
  g += 'classDef vectorCol fill:#15803d,stroke:#166534,color:#fff\n';

  const headerClass: Record<string,string> = {
    'Ares Prime':'aresHeader', 'Guardian Sentinel':'guardianHeader', 'Odyssey Venture':'odysseyHeader', 'Celestial Bloom':'bloomHeader', 'Prometheus Array':'promHeader'
  };
  const crewClass: Record<string,string> = {
    'Ares Prime':'aresCrew', 'Guardian Sentinel':'guardianCrew', 'Odyssey Venture':'odysseyCrew', 'Celestial Bloom':'bloomCrew', 'Prometheus Array':'promCrew'
  };
  const clusterStyle: Record<string,string> = {
    // Subgraph backgrounds to reflect temporal/political origin
    'Ares Prime': 'fill:#fde8e8,stroke:#b91c1c,color:#111,stroke-width:1px',
    'Guardian Sentinel': 'fill:#eaf4ef,stroke:#0f5132,color:#111,stroke-width:1px',
    'Odyssey Venture': 'fill:#eef4ff,stroke:#084298,color:#111,stroke-width:1px',
    'Celestial Bloom': 'fill:#f3faef,stroke:#2d6a4f,color:#111,stroke-width:1px',
    'Prometheus Array': 'fill:#f5e9ff,stroke:#5a189a,color:#111,stroke-width:1px'
  };

  // Palette per ship for gradients (stroke used as max-importance color)
  const shipStroke: Record<string,string> = {
    'Ares Prime': '#b91c1c',
    'Guardian Sentinel': '#0f5132',
    'Odyssey Venture': '#084298',
    'Celestial Bloom': '#2d6a4f',
    'Prometheus Array': '#5a189a',
  };

  // Color utilities
  function hexToRgb(hex: string) { const m = hex.replace('#',''); const n = parseInt(m.length===3? m.split('').map(c=>c+c).join(''): m,16); return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 }; }
  function rgbToHex(r: number, g: number, b: number) { const to = (v:number)=>v.toString(16).padStart(2,'0'); return `#${to(r)}${to(g)}${to(b)}`; }
  function mixHex(a: string, b: string, t: number) { const A=hexToRgb(a), B=hexToRgb(b); const r=Math.round(A.r+(B.r-A.r)*t); const g=Math.round(A.g+(B.g-A.g)*t); const b2=Math.round(A.b+(B.b-A.b)*t); return rgbToHex(r,g,b2); }
  function luminance(hex: string) { const {r,g,b}=hexToRgb(hex); const nl=(v:number)=>{v/=255; return v<=0.03928? v/12.92: Math.pow((v+0.055)/1.055,2.4);}; const L=0.2126*nl(r)+0.7152*nl(g)+0.0722*nl(b); return L; }
  function textForBg(hex: string) { return luminance(hex) > 0.6 ? '#111' : '#fff'; }
  function mentionCount(text: string, name: string) {
    const pattern = name.replace(/[-\s]+/g,'[- ]?');
    const re = new RegExp(`\\b${pattern}\\b`, 'gi');
    const m = text.match(re);
    return m ? m.length : 0;
  }
  // Sort ships by launch year ascending for left-to-right placement
  const ordered = Object.entries(shipsWithDerivedLaunch).sort((a,b) => a[1].launch - b[1].launch);
  for (const [ship, meta] of ordered) {
    const sgId = ship.replace(/[^A-Za-z0-9]/g,'');
    const headId = `${sgId}HEAD`;
    g += `subgraph ${sgId}[${ship}]\n`;
    g += 'direction TB\n';
    const mission = meta.mission.replace(/\"/g, '');
    // Include launch year beneath name
    g += `${headId}["${ship} (${meta.launch})\\n${mission}"]:::${headerClass[ship]}\n`;
    // Vector badge under header
    const badgeId = `${sgId}VEC`;
    const badgeLabel = meta.vector === 'military' ? 'MILITARY' : (meta.vector === 'science' ? 'EXPLORATORY / SCIENCE' : 'COLONIZING');
    const badgeClass = meta.vector === 'military' ? 'vectorMil' : (meta.vector === 'science' ? 'vectorSci' : 'vectorCol');
    g += `${badgeId}["${badgeLabel}"]:::${badgeClass}\n`;
    g += `${headId}-->${badgeId}\n`;
    // Group crew into lanes at departure state
    const cmd: typeof meta.crew = [];
    const ops: typeof meta.crew = [];
    const sci: typeof meta.crew = [];
    meta.crew.forEach((c) => {
      const r = c.role.toLowerCase();
      if (/(admiral|captain|commander|colonel|major|xo)/.test(r)) cmd.push(c);
      else if (/(tactic|operation|engineer|navigator)/.test(r)) ops.push(c);
      else sci.push(c); // science, medical, ethics, diplomacy, botanist, historian, physicist
    });

    // Command lane
    const laneCmdId = `${sgId}CMD`;
    g += `subgraph ${laneCmdId}[Command]\n`;
    g += 'direction LR\n';
    cmd.forEach(({ name, role }) => {
      const nodeId = name.replace(/[^A-Za-z0-9]/g,'');
      const safeRole = role.replace(/\"/g, '');
      g += `${nodeId}["${name}\\n${safeRole}"]:::${crewClass[ship]}\n`;
    });
    g += 'end\n';
    g += `style ${laneCmdId} ${laneCmdStyle}\n`;

    // Operations / Tactics lane
    const laneOpsId = `${sgId}OPS`;
    g += `subgraph ${laneOpsId}[Operations / Tactics]\n`;
    g += 'direction LR\n';
    ops.forEach(({ name, role }) => {
      const nodeId = name.replace(/[^A-Za-z0-9]/g,'');
      const safeRole = role.replace(/\"/g, '');
      g += `${nodeId}["${name}\\n${safeRole}"]:::${crewClass[ship]}\n`;
    });
    g += 'end\n';
    g += `style ${laneOpsId} ${laneOpsStyle}\n`;

    // Science / Medical / Diplomacy lane
    const laneSciId = `${sgId}SCI`;
    g += `subgraph ${laneSciId}[Science / Medical / Diplomacy]\n`;
    g += 'direction LR\n';
    sci.forEach(({ name, role }) => {
      const nodeId = name.replace(/[^A-Za-z0-9]/g,'');
      const safeRole = role.replace(/\"/g, '');
      g += `${nodeId}["${name}\\n${safeRole}"]:::${crewClass[ship]}\n`;
    });
    g += 'end\n';
    g += `style ${laneSciId} ${laneSciStyle}\n`;
    // Compute importance gradient per crew within this ship
    const counts = meta.crew.map(c => mentionCount(md, c.name) + (c.leader ? 2 : 0));
    const max = Math.max(1, ...counts);
    const min = Math.min(...counts);
    meta.crew.forEach((c, idx) => {
      const nodeId = c.name.replace(/[^A-Za-z0-9]/g,'');
      const norm = max === min ? 0.5 : (counts[idx] - min) / (max - min);
      const t = Math.max(0.15, Math.min(0.95, Math.pow(norm, 0.8))); // bias toward mid tones
      const fill = mixHex('#ffffff', shipStroke[ship], t);
      const label = textForBg(fill);
      g += `style ${nodeId} fill:${fill},stroke:${shipStroke[ship]},color:${label}\n`;
    });

    // Style the subgraph background to differentiate temporal origins
    g += `style ${sgId} ${clusterStyle[ship]}\n`;
    g += 'end\n';
    // header → leader → crew
    const leader = meta.crew.find(c => c.leader);
    if (leader) {
      const lid = leader.name.replace(/[^A-Za-z0-9]/g,'');
      g += `${headId}-->${lid}\n`;
      meta.crew.filter(c => !c.leader).forEach(c => {
        const cid = c.name.replace(/[^A-Za-z0-9]/g,'');
        g += `${lid}-->${cid}\n`;
      });
    }
    // Header already emphasized via class
  }

  // Character-level interactions (kept minimal)
  g += 'WEBB-->KAITO\n';
  g += 'VASQUEZ---PARK\n';
  g += 'VASQUEZ-->KAITO\n';
  g += 'KAITO---AL-HAMADI\n';
  g += 'REEVES-->PARK\n';
  g += 'CHEN-->PARK\n';
  g += 'HARTMANN---TCHAIKOVSKY\n';

  // Inter-ship relationships between headers with labels
  const H = (s: string) => `${s.replace(/[^A-Za-z0-9]/g,'')}HEAD`;
  g += `${H('Ares Prime')}--> |ideological pressure| ${H('Odyssey Venture')}\n`;
  g += `${H('Ares Prime')}--- |coordination| ${H('Guardian Sentinel')}\n`;
  g += `${H('Celestial Bloom')}--- |neutral ground| ${H('Guardian Sentinel')}\n`;
  g += `${H('Prometheus Array')}-.-> |warnings / navigation| ${H('Ares Prime')}\n`;
  g += `${H('Prometheus Array')}-.-> |warnings / navigation| ${H('Odyssey Venture')}\n`;
  g += `${H('Prometheus Array')}-.-> |warnings / navigation| ${H('Celestial Bloom')}\n`;

  // Invisible ordering edges between headers (helps enforce LR chronology)
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i][0];
    const b = ordered[i+1][0];
    g += `${H(a)}-->${H(b)}\n`;
    // Note: linkStyle indices vary with upstream edges; leaving visible edges is acceptable if layout holds
  }

  // Legend for vectors and rank meanings
  g += 'subgraph Legend[Legend]\n';
  g += 'direction TB\n';
  g += 'subgraph Legend_Vectors[Vectors]\n';
  g += 'direction LR\n';
  g += 'VECMIL["MILITARY: force, deterrence, enforcement"]:::vectorMil\n';
  g += 'VECSCI["EXPLORATORY / SCIENCE: understanding, navigation, ethics"]:::vectorSci\n';
  g += 'VECCOL["COLONIZING: settlement, care, culture"]:::vectorCol\n';
  g += 'end\n';
  g += 'subgraph Legend_Ranks[Ranks / Roles]\n';
  g += 'direction LR\n';
  g += 'LR1["Admiral / Commander — ship or fleet command"]\n';
  g += 'LR2["Colonel / Major — tactics and operations"]\n';
  g += 'LR3["Captain / Commander — vessel command"]\n';
  g += 'LR4["XO — executive operations / coordination"]\n';
  g += 'LR5["CMO — medical / wellbeing"]\n';
  g += 'LR6["First Contact — diplomacy / linguistics"]\n';
  g += 'LR7["Chief Engineer — systems reliability"]\n';
  g += 'LR8["Lead Physicist / Navigator / AI Ethics — science core"]\n';
  g += 'end\n';
  g += 'end\n';

  return g;
}

export default function MermaidPage({ combined }: { combined: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');
  const panInstance = useRef<ReturnType<typeof panzoom> | null>(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
    const graph = extractGraph(combined);
    mermaid.render('mmd', graph).then(({ svg }) => setSvg(svg)).catch((e) => setSvg(`<pre>${String(e)}</pre>`));
  }, [combined]);

  useEffect(() => {
    // Initialize panzoom after SVG mounts
    const container = ref.current;
    if (!container) return;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    // Destroy any prior instance
    panInstance.current?.dispose?.();
    panInstance.current = panzoom(svgEl as SVGSVGElement, {
      maxZoom: 3,
      minZoom: 0.2,
      smoothScroll: false,
      bounds: false,
      zoomDoubleClickSpeed: 1,
    });
    return () => {
      panInstance.current?.dispose?.();
      panInstance.current = null;
    };
  }, [svg]);

  return (
    <main className="container">
      <h1>Character / Ship Map</h1>
      <div className="no-print" style={{display:'flex', gap:8, marginBottom:8}}>
        <button onClick={() => panInstance.current?.zoomTo(0,0, 1.1)}>+</button>
        <button onClick={() => panInstance.current?.zoomTo(0,0, 0.9)}>-</button>
        <button onClick={() => panInstance.current?.moveTo(0,0)}>Reset</button>
        <button onClick={() => {
          const el = ref.current?.querySelector('svg');
          if (!el) return;
          // Fit: center and scale to container width
          const box = el.getBBox();
          const container = ref.current!.getBoundingClientRect();
          const scale = Math.min(container.width / (box.width + 40), container.height ? container.height / (box.height + 40) : 1);
          panInstance.current?.zoomAbs(0,0, Math.max(0.1, Math.min(2, scale)));
          panInstance.current?.moveTo(0,0);
        }}>Fit</button>
      </div>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: svg }} style={{border:'1px solid #e5e7eb', overflow:'hidden'}} />
      <p className="no-print" style={{marginTop:'1rem'}}>Derived from the three Markdown sources (heuristic). We can refine rules as we iterate.</p>
    </main>
  );
}

export async function getServerSideProps() {
  const contents = await Promise.all(docs.map(d => fs.readFile(d.path, 'utf8').catch(() => '')));
  return { props: { combined: contents.join('\n\n') } };
}


