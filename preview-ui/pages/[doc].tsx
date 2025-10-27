import fs from 'node:fs/promises';
import path from 'node:path';
import { GetServerSideProps } from 'next';
import { useEffect } from 'react';
import { docs, DocEntry } from '../src/docs';
import { remark } from 'remark';
import html from 'remark-html';

type Props = {
  doc: DocEntry;
  mode: 'raw' | 'basic' | 'styled';
  content: string;
  html?: string;
};

export default function DocPage({ doc, mode, content, html: htmlContent }: Props) {
  const styledClass = (() => {
    if (mode !== 'styled') return 'container';
    if (doc.id === 'screenplay') return 'container prose screenplay-prose';
    if (doc.id === 'novel') return 'container prose novel-prose';
    return 'container prose outline-prose';
  })();

  // Attach screenplay enhancer only in styled screenplay mode
  useScreenplayEnhancer(mode === 'styled' && doc.id === 'screenplay');

  return (
    <main className={styledClass}>
      <div className="toolbar no-print">
        <h1>{doc.title}</h1>
        {mode === 'styled' && (
          <button onClick={() => window.print()} title="Export PDF">
            Export PDF
          </button>
        )}
      </div>
      <p className="no-print">
        Viewing <strong>{doc.title}</strong> as <em>{mode}</em>
      </p>
      {mode === 'raw' && (
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
          {content}
        </pre>
      )}
      {mode !== 'raw' && (
        <article id="doc-article" dangerouslySetInnerHTML={{ __html: htmlContent || '' }} />
      )}
    </main>
  );
}

// Enhance screenplay readability with lightweight client-side formatting
// - Bold scene headings (INT./EXT./EST.) and transitions (CUT TO:, etc.)
// - Bold character cues (ALL CAPS short lines)
// - Italicize parentheticals (...)
// Runs only in styled screenplay mode
export function useScreenplayEnhancer(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.getElementById('doc-article');
    if (!root) return;
    const paragraphs = Array.from(root.querySelectorAll('p')) as HTMLParagraphElement[];
    const sceneRe = /^(\s*)(INT\.|EXT\.|INT\/EXT\.|EST\.)\b/i;
    const transitionRe = /:\s*$/; // e.g., CUT TO:
    const cueRe = /^[A-Z0-9 .,'\-()]{2,60}$/; // character cue heuristic (allow slightly longer cues)
    // e.g., WEBB (ON SCREEN) Hello...  |  DR. WEBB (V.O.) — text
    const speakerInlineRe = /^\s*([A-Z][A-Z0-9 .,'’\-]+?)(\s*\([^)]*\))?(?:\s*[:\-–—])?\s+(.+)$/;

    // Collect known character names from cue and inline speaker forms
    const names = new Set<string>();
    paragraphs.forEach((p) => {
      const t = (p.textContent || '').trim();
      if (cueRe.test(t) && t === t.toUpperCase() && t.length <= 60) {
        names.add(t.replace(/\([^)]*\)/g, '').trim());
      } else {
        const m = t.match(speakerInlineRe);
        if (m) {
          const n = (m[1] || '').trim();
          if (n && n === n.toUpperCase() && n.length <= 60) names.add(n);
        }
      }
    });
    const nameRegexes = Array.from(names).map((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'g'));
    let state: 'none' | 'scene' | 'cue' | 'parenth' = 'none';
    paragraphs.forEach((p) => {
      const txt = p.textContent || '';
      let html = p.innerHTML;
      // Parentheticals -> italic
      const isParentheticalLine = /^\s*\([^)]*\)\s*$/.test(txt);
      html = html.replace(/\(([^)]+)\)/g, '<em>($1)</em>');
      // Scene headings & transitions -> bold
      if (sceneRe.test(txt) || transitionRe.test(txt.trim())) {
        html = `<strong>${html}</strong>`;
        p.classList.add('sc-line');
        state = 'scene';
      } else if (cueRe.test(txt.trim()) && txt.trim() === txt.trim().toUpperCase() && txt.trim().length <= 40) {
        // Character cue -> bold
        html = `<strong>${html}</strong>`;
        p.classList.add('sc-cue');
        state = 'cue';
      } else if (isParentheticalLine) {
        p.classList.add('sc-parenth');
        state = 'parenth';
      } else if (!sceneRe.test(txt)) {
        // Inline speaker with dialogue on same line
        const m = txt.match(speakerInlineRe);
        if (m) {
          const name = (m[1] || '').trim();
          // confirm this is really a cue-ish token (mostly uppercase and short)
          if (name === name.toUpperCase() && name.length <= 40) {
            const parenRaw = (m[2] || '');
            const paren = parenRaw.replace(/\(([^)]+)\)/g, '<em>($1)</em>');
            const rest = m[3] || '';
            p.innerHTML = `<strong>${name}</strong>${paren} ${rest}`;
            p.classList.add('sc-dialogue');
            state = 'cue';
            return; // already rewritten
          }
        }
      }
      // Bold any known character names in non-cue lines
      if (!p.classList.contains('sc-line') && !p.classList.contains('sc-cue')) {
        nameRegexes.forEach((re) => { html = html.replace(re, (m) => `<strong>${m}</strong>`); });
      }
      p.innerHTML = html;

      // Classify remaining narrative vs dialogue
      if (!p.classList.contains('sc-line') && !p.classList.contains('sc-cue') && !p.classList.contains('sc-parenth')) {
        if (state === 'cue' || state === 'parenth') {
          p.classList.add('sc-dialogue');
          state = 'cue';
        } else if (state === 'scene') {
          p.classList.add('sc-env'); // environmental description after scene
        } else {
          p.classList.add('sc-action'); // default to action lines
        }
      }

      // Reset state on empty lines
      if (txt.trim() === '') state = 'none';
    });
  }, [enabled]);
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const id = String(ctx.params?.doc || '');
  const modeParam = String(ctx.query.mode || 'basic');
  const mode = (['raw', 'basic', 'styled'] as const).includes(modeParam as any)
    ? (modeParam as Props['mode'])
    : 'basic';

  const doc = docs.find((d) => d.id === id);
  if (!doc) {
    return { notFound: true };
  }

  const mdPath = path.join(process.cwd(), '..', doc.pathFromRoot);
  const mdSource = await fs.readFile(mdPath, 'utf8');

  if (mode === 'raw') {
    return { props: { doc, mode, content: mdSource } };
  }

  const processed = await remark().use(html).process(mdSource);
  const htmlContent = String(processed);
  return { props: { doc, mode, content: mdSource, html: htmlContent } };
};

