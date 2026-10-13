import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Evita cerrar con Esc/fondo mientras se envía. */
  busy?: boolean;
}

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

/**
 * Modal sobre <dialog> nativo: focus trap, Esc, inert del fondo y retorno de foco
 * los provee el navegador.
 */
export function Modal({ open, onClose, title, description, icon, children, footer, size = 'md', busy }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // React no aplica autoFocus dentro de <dialog>: enfocamos el campo marcado
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      // Cerrar al hacer clic en el fondo, solo si el clic EMPEZÓ en el fondo: seleccionar texto
      // dentro del modal y soltar afuera no debe cerrarlo (se perdería lo escrito)
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (e.target === ref.current && pressedBackdrop.current && !busy) onClose();
        pressedBackdrop.current = false;
      }}
      className={cn(
        'ui-window m-auto w-[calc(100%-2rem)] rounded-lg border border-border bg-surface p-0 text-fg shadow-pop',
        'backdrop:bg-overlay open:animate-modal-in',
        widths[size],
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="ui-titlebar flex items-start gap-3 border-b border-border px-5 py-4 classic:px-3 classic:py-2">
            {icon && <div className="mt-0.5 shrink-0 [&_svg]:size-5">{icon}</div>}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <div id={descId} className="mt-1 text-sm text-muted">
                  {description}
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" iconOnly aria-label="Cerrar" onClick={onClose} disabled={busy}>
              <X aria-hidden="true" />
            </Button>
          </header>
          {children && <div className="overflow-y-auto px-5 py-4">{children}</div>}
          {footer && (
            <footer className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface-2/50 px-5 py-3">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
