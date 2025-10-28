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

function extractGraph(md: string, docTexts?: Record<'screenplay'|'novel'|'outline', string>) {
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
        { name: 'WEBB', role: 'Physicist → Sacrifice' },
        { name: 'HAYES', role: 'XO → Commander' }
      ]
    },
    'Guardian Sentinel': {
      mission: 'Protect colonies; peacekeeping',
      launch: 2089,
      vector: 'military',
      crew: [
        { name: 'PARK', role: 'Colonel / Command', leader: true },
        { name: 'REEVES', role: 'Major / Peacekeepers' },
        { name: 'OSEI', role: 'Chaplain / Ethics' }
      ]
    },
    'Odyssey Venture': {
      mission: 'Explore; understand; diplomacy-first',
      launch: 2134,
      vector: 'science',
      crew: [
        { name: 'KAITO', role: 'Captain / Scientist', leader: true },
        { name: 'OKONKWO', role: 'Chief Engineer → First Officer' },
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
        { name: 'MALIK', role: 'Chief Medical Officer' },
        { name: 'KIMURA', role: 'Systems / Orchard' },
        { name: 'ALVAREZ', role: 'Logistics → Peacekeepers' }
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
  // Connection event nodes (clickable)
  g += 'classDef event fill:#fff7ed,stroke:#c2410c,color:#111,stroke-dasharray: 2 2\n';
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

  // Helper to sanitize IDs like node creation above
  const idOf = (s: string) => s.replace(/[^A-Za-z0-9]/g,'');
  const url = (doc: 'screenplay'|'novel'|'outline', q: string) => `/${doc}?mode=styled&q=${encodeURIComponent(q)}`;
  let ev = 0;
  function addEvent(from: string, to: string, label: string, doc: 'screenplay'|'novel'|'outline', q: string) {
    const eId = `EV${ev++}`;
    const safeLabel = label.replace(/\"/g, "'").replace(/"/g, "'");
    g += `${eId}["${safeLabel}"]:::event\n`;
    g += `${idOf(from)}-->${eId}-->${idOf(to)}\n`;
    g += `click ${eId} "${url(doc, q)}" "${safeLabel} — open ${doc}"\n`;
  }
  function findPhrase(doc: 'screenplay'|'novel'|'outline', phrases: string[]): string | undefined {
    const text = (docTexts?.[doc] ?? '').toLowerCase();
    for (const p of phrases) { if (text.includes(p.toLowerCase())) return p; }
    return undefined;
  }
  function addEventSmart(from: string, to: string, label: string, candidates: Array<{doc: 'screenplay'|'novel'|'outline', phrases: string[] }>) {
    for (const c of candidates) {
      const phrase = findPhrase(c.doc, c.phrases);
      if (phrase) { addEvent(from, to, label, c.doc, phrase); return; }
    }
    addEvent(from, to, label, 'outline', `${from} ${to}`);
  }

  // Character-level interactions with reasons + links
  addEventSmart('WEBB','KAITO','defection toward exploration', [
    { doc: 'screenplay', phrases: ['We come in peace','Odyssey Venture, launched from Earth in the year 2134'] },
    { doc: 'outline', phrases: ["Odyssey Venture (2134) represents new philosophy", "explore, don't exploit"] },
    { doc: 'novel', phrases: ['Odyssey Venture - Earth Year 2134'] },
  ]);
  addEventSmart('OKONKWO','CHEN','secondment to Bloom (orchard quench)', [
    { doc: 'screenplay', phrases: ['ORCHARD QUENCH','Parole of Purpose applies'] },
    { doc: 'novel', phrases: ['INTERLUDE: Second Parole — The Corridor Oath','Parole of Purpose'] },
  ]);
  addEventSmart('ALVAREZ','REEVES','Mira Alvarez joins Peacekeepers', [
    { doc: 'screenplay', phrases: ['SECOND PAROLE — PEACEKEEPERS TAKE A BLOOM','Welcome to regulated mercy.'] },
    { doc: 'novel', phrases: ['Second Parole — The Corridor Oath','Peacekeepers Logistics'] },
  ]);
  addEventSmart('VASQUEZ','PARK','shared era / mutual respect', [
    { doc: 'outline', phrases: ['Ares Prime (2087) and Guardian Sentinel (2089) launched'] },
    { doc: 'novel', phrases: ['Ares Prime - Earth Year 2087','Guardian Sentinel - Earth Year 2089'] },
  ]);
  addEventSmart('VASQUEZ','KAITO','ideology clash', [
    { doc: 'screenplay', phrases: ['This system is under military jurisdiction','We come in peace'] },
    { doc: 'outline', phrases: ["explore, don't exploit"] },
  ]);
  addEventSmart('OSEI','VASQUEZ','honor clause invoked', [
    { doc: 'novel', phrases: ['Kinship Honor Clause'] },
    { doc: 'screenplay', phrases: ['honor clause','Peacekeepers triad will witness'] },
  ]);
  addEventSmart('VENKATARAMAN','OKONKWO','kinship registry discovery', [
    { doc: 'novel', phrases: ['Registry — Kin Across Time','Sato/Sato'] },
  ]);
  addEventSmart('HAYES','VASQUEZ','command transfer (Three Tests)', [
    { doc: 'screenplay', phrases: ['Three Tests','necessity, proportionality, reversibility'] },
  ]);
  addEventSmart('KAITO','AL-HAMADI','science exchange / navigation ethics', [
    { doc: 'outline', phrases: ['Prometheus Array (2103) launched as compromise','Map temporal wake'] },
  ]);
  addEventSmart('REEVES','PARK','peacekeeping alignment', [
    { doc: 'outline', phrases: ['Temporal Peacekeepers'] },
  ]);
  addEventSmart('CHEN','PARK','offers neutral ground', [
    { doc: 'outline', phrases: ['neutral ground'] },
  ]);
  addEventSmart('HARTMANN','TCHAIKOVSKY','knowledge exchange', [
    { doc: 'novel', phrases: ['navigation patterns','Navigator'] },
  ]);

  // Inter-ship relationships between headers with labels
  const H = (s: string) => `${s.replace(/[^A-Za-z0-9]/g,'')}HEAD`;
  // Inter-ship relationships via event nodes with links (smart phrases)
  function addShipEventSmart(fromShip: string, toShip: string, label: string, candidates: Array<{doc: 'screenplay'|'novel'|'outline', phrases: string[] }>) {
    const eId = `SEV${ev++}`;
    const safeLabel = label.replace(/\"/g, "'").replace(/"/g, "'");
    g += `${eId}["${safeLabel}"]:::event\n`;
    g += `${H(fromShip)}-->${eId}-->${H(toShip)}\n`;
    for (const c of candidates) {
      const phrase = findPhrase(c.doc, c.phrases);
      if (phrase) { g += `click ${eId} "${url(c.doc, phrase)}" "${safeLabel} — open ${c.doc}"\n`; return; }
    }
  }
  addShipEventSmart('Ares Prime','Odyssey Venture','ideological pressure', [
    { doc: 'screenplay', phrases: ['This system is under military jurisdiction','We come in peace'] },
    { doc: 'outline', phrases: ["explore, don't exploit"] },
  ]);
  addShipEventSmart('Ares Prime','Guardian Sentinel','coordination', [
    { doc: 'outline', phrases: ['Protect colonies','peacekeeping'] },
  ]);
  addShipEventSmart('Celestial Bloom','Guardian Sentinel','neutral ground', [
    { doc: 'outline', phrases: ['neutral ground'] },
  ]);
  addShipEventSmart('Prometheus Array','Ares Prime','warnings / navigation', [
    { doc: 'outline', phrases: ['launched as compromise','Map temporal wake'] },
  ]);
  addShipEventSmart('Prometheus Array','Odyssey Venture','warnings / navigation', [
    { doc: 'outline', phrases: ['navigation'] },
  ]);
  addShipEventSmart('Prometheus Array','Celestial Bloom','warnings / navigation', [
    { doc: 'outline', phrases: ['navigation'] },
  ]);

  // Epilogue anchors: 1977 Wow! detection and 2312 consolidated bursts
  addShipEventSmart('Prometheus Array','Odyssey Venture','Epilogue: 1977 "Wow!" displacement (hidden cadence)', [
    { doc: 'novel', phrases: ['Earth — 1977 (Ohio)','6EQUJ5'] },
    { doc: 'outline', phrases: ['Earth (1977, Big Ear, Ohio)'] },
  ]);
  addShipEventSmart('Prometheus Array','Celestial Bloom','Epilogue: 2312 consolidated signals to Earth', [
    { doc: 'outline', phrases: ['Earth (Year 2312, consolidated bursts)'] },
  ]);

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
  g += 'subgraph Legend_Protocols[Protocols / SOPs]\n';
  g += 'direction LR\n';
  g += 'LP1["Parole of Purpose — handover, no sabotage, announce intent"]\n';
  g += 'LP2["Neutral Corridors — blue/green routes, no arms"]\n';
  g += 'LP3["Honor Clause — no first strike across confirmed kin"]\n';
  g += 'end\n';
  g += 'end\n';

  return g;
}

export default function MermaidPage({ combined, texts }: { combined: string; texts: Record<'screenplay'|'novel'|'outline', string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');
  const panInstance = useRef<ReturnType<typeof panzoom> | null>(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
    const graph = extractGraph(combined, texts);
    mermaid.render('mmd', graph).then(({ svg }) => setSvg(svg)).catch((e) => setSvg(`<pre>${String(e)}</pre>`));
  }, [combined, texts]);

  useEffect(() => {
    // Initialize panzoom after SVG mounts
    const container = ref.current;
    if (!container) return;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    // Destroy any prior instance
    panInstance.current?.dispose?.();
    panInstance.current = panzoom(svgEl as SVGSVGElement, {
      maxZoom: 10,
      minZoom: 0.05,
      smoothScroll: true,
      bounds: false,
      zoomDoubleClickSpeed: 1.4,
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
        <button onClick={() => panInstance.current?.zoomAbs(0,0,1)}>100%</button>
        <button onClick={() => {
          const container = ref.current as HTMLElement | null;
          if (!container) return;
          const anyEl: any = container;
          if (document.fullscreenElement) {
            document.exitFullscreen?.();
          } else {
            (anyEl.requestFullscreen || anyEl.webkitRequestFullscreen || anyEl.msRequestFullscreen)?.call(anyEl);
          }
        }}>Fullscreen</button>
      </div>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: svg }} style={{border:'1px solid #e5e7eb', overflow:'hidden', height:'85vh'}} />
      <p className="no-print" style={{marginTop:'1rem'}}>Derived from the three Markdown sources (heuristic). We can refine rules as we iterate.</p>
    </main>
  );
}

export async function getServerSideProps() {
  const entries = await Promise.all(docs.map(async d => ({ id: d.id, text: await fs.readFile(d.path, 'utf8').catch(() => '') })));
  const texts = entries.reduce((acc, e) => { (acc as any)[e.id] = e.text; return acc; }, {} as Record<'screenplay'|'novel'|'outline', string>);
  return { props: { combined: Object.values(texts).join('\n\n'), texts } };
}


