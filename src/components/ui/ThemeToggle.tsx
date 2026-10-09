import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { applyTheme, getThemePreference, type ThemePreference } from '@/lib/theme';
import { Button } from './Button';

const order: readonly ThemePreference[] = ['light', 'dark', 'system'];
const labels: Record<ThemePreference, string> = { light: 'claro', dark: 'oscuro', system: 'del sistema' };

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>(() => getThemePreference());

  useEffect(() => {
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  function cycle() {
    const next = order[(order.indexOf(pref) + 1) % order.length] ?? 'system';
    applyTheme(next);
    setPref(next);
  }

  const Icon = pref === 'light' ? Sun : pref === 'dark' ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      iconOnly
      onClick={cycle}
      aria-label={`Tema ${labels[pref]}. Cambiar tema`}
      title={`Tema ${labels[pref]}`}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
