import Link from 'next/link';
import { docs } from '../src/docs';

export default function Home() {
  return (
    <main className="container">
      <h1>Temporal Wake Preview</h1>
      <p>Select a document and rendering style:</p>
      <ul>
        {docs.map((d) => (
          <li key={d.id}>
            <strong>{d.title}</strong>
            <ul>
              <li><Link href={`/${d.id}?mode=raw`}>Raw Markdown (no styling)</Link></li>
              <li><Link href={`/${d.id}?mode=basic`}>Basic HTML (remark-html)</Link></li>
              <li><Link href={`/${d.id}?mode=styled`}>Styled HTML (app CSS)</Link></li>
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}

