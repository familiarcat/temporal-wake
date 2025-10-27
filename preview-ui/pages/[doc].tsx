import fs from 'node:fs/promises';
import path from 'node:path';
import { GetServerSideProps } from 'next';
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
  return (
    <main className={mode === 'styled' ? 'container prose' : 'container'}>
      <h1>{doc.title}</h1>
      <p>
        Viewing <strong>{doc.title}</strong> as <em>{mode}</em>
      </p>
      {mode === 'raw' && (
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
          {content}
        </pre>
      )}
      {mode !== 'raw' && (
        <article dangerouslySetInnerHTML={{ __html: htmlContent || '' }} />
      )}
    </main>
  );
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

