import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function NavBar() {
  const router = useRouter();
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 1000);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isActive = (href: string) => router.pathname === href;

  const navStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    background: '#0b1220',
    color: '#e5e7eb',
    borderBottom: '1px solid #1f2937',
    zIndex: 1000,
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: 1400,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 16px',
    height: '100%',
  };

  const linkStyle = (active: boolean): React.CSSProperties => ({
    color: active ? '#fff' : '#e5e7eb',
    textDecoration: 'none',
    fontWeight: active ? 700 : 500,
    padding: '6px 10px',
    borderRadius: 6,
    border: active ? '1px solid #334155' : '1px solid transparent',
    opacity: active ? 1 : 0.9,
    fontSize: 14,
  });

  const spacer: React.CSSProperties = { height: 56 };

  return (
    <>
      <nav style={navStyle}>
        <div style={containerStyle}>
          <Link href="/" style={{ ...linkStyle(isActive('/')), fontWeight: 800 }}>Temporal Wake</Link>
          <Link href="/novel?mode=styled" style={linkStyle(isActive('/novel'))}>Novel</Link>
          <Link href="/screenplay?mode=styled" style={linkStyle(isActive('/screenplay'))}>Screenplay</Link>
          <Link href="/outline?mode=styled" style={linkStyle(isActive('/outline'))}>Outline</Link>
          <Link href="/mermaid" style={linkStyle(isActive('/mermaid'))}>Map</Link>
          <Link href="/mermaid_timeline" style={linkStyle(isActive('/mermaid_timeline'))}>Timeline</Link>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isNarrow && <span style={{ fontSize: 12, opacity: 0.7 }}>{router.pathname}</span>}
          </div>
        </div>
      </nav>
      {/* spacer so content sits below fixed nav */}
      <div style={spacer} />
    </>
  );
}


