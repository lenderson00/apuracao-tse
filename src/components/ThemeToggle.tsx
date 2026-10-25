import { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-switching');
    root.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    const id = window.setTimeout(() => root.classList.remove('theme-switching'), 50);
    return () => window.clearTimeout(id);
  }, [dark]);

  return (
    <Button
      variant="ghost"
      icon
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
      title={dark ? 'Tema claro' : 'Tema escuro'}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={17} />
    </Button>
  );
}
