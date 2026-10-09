import { useState, type ReactNode } from 'react';
import { Ban, Inbox, Lock, Plus, Save, Search, Trash2 } from 'lucide-react';
import { AlertFlags } from '@/components/domain/AlertFlags';
import { PriorityBadge } from '@/components/domain/PriorityBadge';
import { PriorityMatrix } from '@/components/domain/PriorityMatrix';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { EmptyState, ErrorState, LoadingState, Skeleton } from '@/components/ui/States';
import { TBody, THead, Table, Td, Th, Tr } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { IMPACTO_LABEL, URGENCIA_LABEL } from '@/lib/domain/labels';
import { toast } from '@/lib/toast';
import { calculatePriority } from '@/lib/workflow/priority';
import {
  ESTADOS, NIVELES_IMPACTO, NIVELES_URGENCIA, PRIORIDADES, type Impacto, type Urgencia,
} from '@/types/domain';

const TOKENS: readonly { name: string; light: string; dark: string; cls: string }[] = [
  { name: 'bg', light: '#F6F8FB', dark: '#0B1220', cls: 'bg-bg' },
  { name: 'surface', light: '#FFFFFF', dark: '#111A2E', cls: 'bg-surface' },
  { name: 'surface-2', light: '#EEF2F7', dark: '#18233A', cls: 'bg-surface-2' },
  { name: 'border', light: '#D5DCE6', dark: '#26324A', cls: 'bg-border' },
  { name: 'text', light: '#0F172A', dark: '#E6EBF2', cls: 'bg-fg' },
  { name: 'text-muted', light: '#475569', dark: '#9AA8BD', cls: 'bg-muted' },
  { name: 'primary', light: '#1D4ED8', dark: '#60A5FA', cls: 'bg-primary' },
  { name: 'success', light: '#15803D', dark: '#4ADE80', cls: 'bg-success' },
  { name: 'warning', light: '#B45309', dark: '#FBBF24', cls: 'bg-warning' },
  { name: 'danger', light: '#B91C1C', dark: '#F87171', cls: 'bg-danger' },
  { name: 'info', light: '#0E7490', dark: '#22D3EE', cls: 'bg-info' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader title={title} />
      <CardBody className="flex flex-col gap-4">{children}</CardBody>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="w-32 shrink-0 text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export default function DesignSystemPage() {
  const [modal, setModal] = useState(false);
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
  const [impacto, setImpacto] = useState<Impacto>('ALTO');
  const [urgencia, setUrgencia] = useState<Urgencia>('ALTA');

  return (
    <AppShell
      currentPath="/design"
      title="Sistema de diseño"
      description="Tokens y componentes base del MVP. Página interna de referencia."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Paleta (tokens semánticos)">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TOKENS.map((t) => (
              <li key={t.name} className="flex items-center gap-2.5">
                <span className={`size-9 shrink-0 rounded-md border border-border ${t.cls}`} aria-hidden="true" />
                <span className="min-w-0 leading-tight">
                  <span className="block font-mono text-xs font-semibold">{t.name}</span>
                  <span className="block font-mono text-[11px] break-all text-muted">
                    {t.light} / {t.dark}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Tipografía">
          <p className="text-3xl font-bold tabular-nums">128 <span className="text-base font-medium text-muted">métrica · 3xl/700</span></p>
          <p className="text-2xl font-semibold tracking-tight">Título de página · 2xl/600</p>
          <p className="text-lg font-semibold">Título de sección · lg/600</p>
          <p className="text-base">Texto base · 16/24 Inter</p>
          <p className="text-sm text-muted">Texto de UI secundario · 14/20</p>
          <p className="font-mono text-sm">OS-2026-0042 · SN PF2XK9L1 · JetBrains Mono</p>
        </Section>

        <Section title="Botones">
          <Row label="Variantes">
            <Button leftIcon={<Plus aria-hidden="true" />}>Primario</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="outline">Contorno</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button variant="danger" leftIcon={<Trash2 aria-hidden="true" />}>Peligro</Button>
          </Row>
          <Row label="Tamaños">
            <Button size="sm">Pequeño</Button>
            <Button size="md">Mediano</Button>
            <Button size="lg">Grande</Button>
            <Button iconOnly aria-label="Buscar" variant="outline"><Search aria-hidden="true" /></Button>
          </Row>
          <Row label="Estados">
            <Button loading>Guardando</Button>
            <Button disabled>Deshabilitado</Button>
          </Row>
        </Section>

        <Section title="Formularios">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="ds-name" label="Nombre del cliente" required placeholder="Ej. Juan Pérez" />
            <Input id="ds-search" label="Buscar" leftIcon={<Search aria-hidden="true" />} placeholder="Número o serie" hint="Presioná / para enfocar la búsqueda global" />
            <Input id="ds-error" label="Teléfono" required defaultValue="11-55" error="Ingresá un teléfono válido" />
            <Select id="ds-select" label="Responsable" required placeholder="Elegí un responsable" options={[{ value: '1', label: 'Carlos Ibáñez' }, { value: '2', label: 'Julieta Paz' }]} />
          </div>
          <Textarea id="ds-text" label="Comentario" required hint="Mínimo 10 caracteres" rows={3} />
          <Checkbox id="ds-check" label="Validación visual del supervisor" description="Confirmo que revisé el equipo reparado." />
        </Section>

        <Section title="Estados de la orden">
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map((e) => <StatusBadge key={e} estado={e} />)}
          </div>
        </Section>

        <Section title="Prioridad y alertas">
          <div className="flex flex-wrap gap-2">
            {PRIORIDADES.map((p) => <PriorityBadge key={p} prioridad={p} />)}
          </div>
          <AlertFlags criticaVencida horasAbierta={31} bloqueada escalada atrasada size="md" />
        </Section>

        <Section title="Matriz de prioridad (interactiva)">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select id="ds-imp" label="Impacto" value={impacto} onChange={(e) => setImpacto(e.target.value as Impacto)} options={NIVELES_IMPACTO.map((v) => ({ value: v, label: IMPACTO_LABEL[v] }))} />
            <Select id="ds-urg" label="Urgencia" value={urgencia} onChange={(e) => setUrgencia(e.target.value as Urgencia)} options={NIVELES_URGENCIA.map((v) => ({ value: v, label: URGENCIA_LABEL[v] }))} />
          </div>
          <PriorityMatrix impacto={impacto} urgencia={urgencia} />
          <p className="flex items-center gap-2 text-sm" aria-live="polite">
            Prioridad calculada: <PriorityBadge prioridad={calculatePriority(impacto, urgencia)} />
          </p>
        </Section>

        <Section title="Modal, toasts y tabs">
          <Row label="Modal">
            <Button variant="outline" leftIcon={<Lock aria-hidden="true" />} onClick={() => setModal(true)}>Bloquear orden</Button>
          </Row>
          <Row label="Toasts">
            <Button size="sm" variant="secondary" onClick={() => toast.success('Orden creada', { description: 'OS-2026-0108 quedó en Recibido.' })}>Éxito</Button>
            <Button size="sm" variant="secondary" onClick={() => toast.error('No se puede mover a Listo para retirar', { details: ['Falta documentar la solución', 'Falta un comentario'] })}>Error</Button>
            <Button size="sm" variant="secondary" onClick={() => toast.warning('Orden crítica abierta hace 31 h')}>Aviso</Button>
            <Button size="sm" variant="secondary" onClick={() => toast.info('Datos de demo reiniciados')}>Info</Button>
          </Row>
          <Tabs
            label="Ejemplo de pestañas"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'a', label: 'Detalle' },
              { id: 'b', label: 'Historial' },
              { id: 'c', label: 'Solución y evidencia' },
            ]}
          >
            <p className="text-muted">Contenido de la pestaña «{tab}». Usá las flechas para moverte entre pestañas.</p>
          </Tabs>
        </Section>

        <Section title="Tabla">
          <Card className="overflow-hidden shadow-none">
            <Table caption="Órdenes de ejemplo">
              <THead>
                <tr><Th>Nº</Th><Th>Cliente</Th><Th>Estado</Th><Th>Prioridad</Th></tr>
              </THead>
              <TBody>
                <Tr><Td className="font-mono">OS-0101</Td><Td>Juan Pérez</Td><Td><StatusBadge estado="EN_DIAGNOSTICO" size="sm" /></Td><Td><PriorityBadge prioridad="CRITICA" size="sm" /></Td></Tr>
                <Tr><Td className="font-mono">OS-0104</Td><Td>Lucía Fernández</Td><Td><StatusBadge estado="EN_REPARACION" size="sm" /></Td><Td><PriorityBadge prioridad="ALTA" size="sm" /></Td></Tr>
              </TBody>
            </Table>
          </Card>
        </Section>

        <Section title="Estados vacío, carga y error">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-none"><EmptyState compact icon={<Inbox aria-hidden="true" />} title="Sin órdenes" description="No hay órdenes en este estado." /></Card>
            <Card className="shadow-none"><LoadingState /><div className="space-y-2 px-4 pb-4"><Skeleton className="h-4" /><Skeleton className="h-4 w-2/3" /></div></Card>
            <Card className="shadow-none"><ErrorState title="Error al cargar" onRetry={() => toast.info('Reintentando…')} className="py-6" /></Card>
          </div>
        </Section>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Bloquear orden OS-0104"
        description="La orden no podrá avanzar hasta que se desbloquee."
        icon={<Ban className="text-danger" aria-hidden="true" />}
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button variant="danger" leftIcon={<Save aria-hidden="true" />} onClick={() => { setModal(false); toast.success('Orden bloqueada'); }}>
              Bloquear
            </Button>
          </>
        }
      >
        <Textarea id="ds-motivo" label="Motivo" required hint="Obligatorio. Ej.: esperando repuesto." />
      </Modal>
    </AppShell>
  );
}
