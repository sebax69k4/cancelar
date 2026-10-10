import { useRef, useState, type DragEvent } from 'react';
import { FileImage, FileText, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { notifyError } from '@/lib/notify';
import { toast } from '@/lib/toast';
import { MOCK_USERS } from '@/mocks/users';
import type { Evidencia } from '@/types/domain';
import type { EvidenceInput } from '@/lib/api/apiClient';

const ACCEPT = 'image/*,application/pdf';
const MAX_MB = 10;

export interface EvidenceUploaderProps {
  evidencias: readonly Evidencia[];
  canEdit: boolean;
  busy?: boolean;
  onAdd: (file: EvidenceInput) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
}

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

/**
 * Adjuntador MOCK: solo registra nombre, tipo y tamaño del archivo.
 * El archivo no se sube ni se guarda. Con backend real: POST multipart a /orders/:id/evidence.
 */
export function EvidenceUploader({ evidencias, canEdit, busy, onAdd, onRemove }: EvidenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list)) {
      if (!f.type.startsWith('image/') && f.type !== 'application/pdf') {
        toast.warning(`«${f.name}» no es una imagen ni un PDF`);
        continue;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        toast.warning(`«${f.name}» supera ${MAX_MB} MB`);
        continue;
      }
      try {
        await onAdd({ nombreArchivo: f.name, tipoMime: f.type, tamanoKb: Math.max(1, Math.round(f.size / 1024)), file: f });
        toast.success(`Evidencia «${f.name}» adjunta`);
      } catch (e) {
        notifyError(e);
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (canEdit) void handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
            dragOver ? 'border-primary bg-primary-soft' : 'border-border-strong',
          )}
        >
          <UploadCloud className="size-7 text-muted" aria-hidden="true" />
          <p className="text-sm">
            Arrastrá fotos o PDF acá, o{' '}
            <Button variant="outline" size="sm" className="mx-1 align-middle" loading={busy} onClick={() => inputRef.current?.click()}>
              elegí archivos
            </Button>
          </p>
          <p className="text-xs text-muted">
            Demo: solo se registra el nombre y el tamaño, el archivo no se sube. Máx. {MAX_MB} MB.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label="Elegir archivos de evidencia"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>
      )}

      {evidencias.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Paperclip className="size-4" aria-hidden="true" /> Todavía no hay evidencias adjuntas.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {evidencias.map((ev) => {
            const Icon = ev.tipoMime === 'application/pdf' ? FileText : FileImage;
            const who = MOCK_USERS.find((u) => u.id === ev.subidaPorId)?.nombre ?? '—';
            return (
              <li key={ev.id} className="flex items-center gap-3 px-3 py-2">
                <Icon className="size-5 shrink-0 text-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{ev.nombreArchivo}</p>
                  <p className="text-xs text-muted">
                    {formatSize(ev.tamanoKb)} · {who} · {formatDateTime(ev.fecha)}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={`Quitar ${ev.nombreArchivo}`}
                    onClick={() =>
                      onRemove(ev.id).then(
                        () => toast.info(`Evidencia «${ev.nombreArchivo}» quitada`),
                        notifyError,
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
