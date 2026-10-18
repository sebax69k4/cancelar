import { useEffect, useState } from 'react';
import { Pencil, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

export interface EditableTextProps {
  id: string;
  label: string;
  value: string | null;
  emptyText: string;
  placeholder?: string;
  hint?: string;
  canEdit: boolean;
  busy?: boolean;
  minLength?: number;
  onSave: (value: string) => Promise<unknown>;
  /** Cada vez que cambia (y es > 0) se abre la edición: lo usa «Siguiente paso». */
  editRequest?: number;
}

/** Bloque de texto con modo lectura/edición (diagnóstico, solución). */
export function EditableText({
  id, label, value, emptyText, placeholder, hint, canEdit, busy, minLength = 5, onSave, editRequest = 0,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  useEffect(() => {
    if (editRequest > 0 && canEdit) setEditing(true);
  }, [editRequest, canEdit]);

  if (!editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{label}</h3>
          {canEdit && (
            <Button variant="ghost" size="sm" leftIcon={<Pencil aria-hidden="true" />} onClick={() => setEditing(true)}>
              {value ? 'Editar' : 'Cargar'}
              <span className="sr-only"> {label.toLowerCase()}</span>
            </Button>
          )}
        </div>
        {value ? (
          <p className="rounded-md bg-surface-2 px-3 py-2 text-sm whitespace-pre-line">{value}</p>
        ) : (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted">{emptyText}</p>
        )}
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.trim().length < minLength) {
          setError(`Mínimo ${minLength} caracteres`);
          return;
        }
        setError(undefined);
        void onSave(draft.trim()).then(() => setEditing(false), () => undefined);
      }}
    >
      <Textarea
        id={id}
        label={label}
        required
        rows={4}
        autoFocus
        value={draft}
        placeholder={placeholder}
        hint={hint}
        error={error}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={busy} leftIcon={<Save aria-hidden="true" />}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
