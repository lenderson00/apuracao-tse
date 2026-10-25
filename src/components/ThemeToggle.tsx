import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true,
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light') setDark(false);
    else if (stored === 'dark') setDark(true);
    else setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
      aria-label="Alternar tema"
    >
      {dark ? 'Claro' : 'Escuro'}
    </button>
  );
}
