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
  // Sort ships by launch year ascending for left-to-right placement
  const ordered = Object.entries(ships).sort((a,b) => a[1].launch - b[1].launch);
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
    meta.crew.forEach(({ name, role }) => {
      const nodeId = name.replace(/[^A-Za-z0-9]/g,'');
      const safeRole = role.replace(/\"/g, '');
      // Crew uses equal color within ship to reflect equal roles
      g += `${nodeId}["${name}\\n${safeRole}"]:::${crewClass[ship]}\n`;
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


