import { useState } from 'react';
import { AppWindow, Sparkles } from 'lucide-react';
import { applySkin, getSkin, type Skin } from '@/lib/skin';
import { Button } from './Button';

/** Alterna entre el estilo clásico (Windows 2000) y el moderno. */
export function SkinToggle() {
  const [skin, setSkin] = useState<Skin>(() => getSkin());
  const next: Skin = skin === 'classic' ? 'modern' : 'classic';
  const Icon = skin === 'classic' ? Sparkles : AppWindow;

  return (
    <Button
      variant="ghost"
      iconOnly
      onClick={() => {
        applySkin(next);
        setSkin(next);
      }}
      aria-label={`Estilo ${skin === 'classic' ? 'clásico' : 'moderno'}. Cambiar a estilo ${next === 'classic' ? 'clásico' : 'moderno'}`}
      title={next === 'classic' ? 'Cambiar a estilo clásico (Windows 2000)' : 'Cambiar a estilo moderno'}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
