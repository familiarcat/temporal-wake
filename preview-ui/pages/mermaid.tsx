import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import fs from 'node:fs/promises';
import path from 'node:path';

type Doc = { id: 'screenplay'|'novel'|'outline'; title: string; path: string };
const docs: Doc[] = [
  { id: 'screenplay', title: 'Screenplay', path: path.join(process.cwd(), '..', 'temporal_wake_screenplay.md') },
  { id: 'novel', title: 'Novel', path: path.join(process.cwd(), '..', 'temporal_wake_novel.md') },
  { id: 'outline', title: 'Outline', path: path.join(process.cwd(), '..', 'temporal_wake_outline.md') },
];

function extractGraph(md: string) {
  // Ships with mission headers and hierarchical crew
  type Crew = { name: string; role: string; leader?: boolean };
  type Ship = { mission: string; crew: Crew[] };
  const ships: Record<string, Ship> = {
    'Ares Prime': {
      mission: 'Claim strength → mediate peace',
      crew: [
        { name: 'VASQUEZ', role: 'Admiral / Commander', leader: true },
        { name: 'WEBB', role: 'Physicist → Redemption' },
        { name: 'HAYES', role: 'XO / Operations' }
      ]
    },
    'Guardian Sentinel': {
      mission: 'Protect colonies; peacekeeping',
      crew: [
        { name: 'PARK', role: 'Colonel / Command', leader: true },
        { name: 'REEVES', role: 'Major / Tactics' },
        { name: 'OSEI', role: 'Chaplain / Ethics' }
      ]
    },
    'Odyssey Venture': {
      mission: 'Explore; understand; diplomacy-first',
      crew: [
        { name: 'KAITO', role: 'Captain / Scientist', leader: true },
        { name: 'OKONKWO', role: 'Chief Engineer' },
        { name: 'VENKATARAMAN', role: 'First Contact' }
      ]
    },
    'Celestial Bloom': {
      mission: 'Build a home; open colony',
      crew: [
        { name: 'CHEN', role: 'Commander', leader: true },
        { name: 'HARTMANN', role: 'Botanist / Historian' },
        { name: 'MALIK', role: 'Chief Medical Officer' }
      ]
    },
    'Prometheus Array': {
      mission: 'Map temporal wake; restraint',
      crew: [
        { name: 'AL-HAMADI', role: 'Lead Physicist', leader: true },
        { name: 'TCHAIKOVSKY', role: 'Navigator' },
        { name: 'SATO', role: 'AI Ethics' }
      ]
    }
  };

  // Build Mermaid graph
  let g = 'graph TD\n';
  g += 'classDef ares fill:#f8d7da,stroke:#b02a37,color:#111,font-weight:bold\n';
  g += 'classDef guardian fill:#d1e7dd,stroke:#0f5132,color:#111\n';
  g += 'classDef odyssey fill:#e7f1ff,stroke:#084298,color:#111\n';
  g += 'classDef bloom fill:#f0f9f0,stroke:#2d6a4f,color:#111\n';
  g += 'classDef prometheus fill:#efeafe,stroke:#5a189a,color:#111\n';

  const classes: Record<string,string> = {
    'Ares Prime':'ares', 'Guardian Sentinel':'guardian', 'Odyssey Venture':'odyssey', 'Celestial Bloom':'bloom', 'Prometheus Array':'prometheus'
  };
  for (const [ship, meta] of Object.entries(ships)) {
    const sgId = ship.replace(/[^A-Za-z0-9]/g,'');
    const headId = `${sgId}HEAD`;
    g += `subgraph ${sgId}[${ship}]\n`;
    g += 'direction TB\n';
    const mission = meta.mission.replace(/\"/g, '');
    // Prominent ship header node with mission line, styled by ship color; thicker border
    g += `${headId}["${ship}\\n${mission}"]:::${classes[ship]}\n`;
    meta.crew.forEach(({ name, role }) => {
      const nodeId = name.replace(/[^A-Za-z0-9]/g,'');
      const safeRole = role.replace(/\"/g, '');
      g += `${nodeId}["${name}\\n${safeRole}"]:::${classes[ship]}\n`;
    });
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
    // Emphasize header
    g += `style ${headId} stroke-width:3px\n`;
  }

  // Character-level interactions (kept minimal)
  g += 'WEBB-->KAITO\n';
  g += 'VASQUEZ---PARK\n';
  g += 'VASQUEZ-->KAITO\n';
  g += 'KAITO---ALHAMADI\n';
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

  return g;
}

export default function MermaidPage({ combined }: { combined: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
    const graph = extractGraph(combined);
    mermaid.render('mmd', graph).then(({ svg }) => setSvg(svg)).catch((e) => setSvg(`<pre>${String(e)}</pre>`));
  }, [combined]);

  return (
    <main className="container">
      <h1>Character / Ship Map</h1>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="no-print" style={{marginTop:'1rem'}}>Derived from the three Markdown sources (heuristic). We can refine rules as we iterate.</p>
    </main>
  );
}

export async function getServerSideProps() {
  const contents = await Promise.all(docs.map(d => fs.readFile(d.path, 'utf8').catch(() => '')));
  return { props: { combined: contents.join('\n\n') } };
}


