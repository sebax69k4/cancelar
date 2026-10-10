import { useState } from 'react';
import { Pencil, Save, UserCog } from 'lucide-react';
import { PriorityBadge } from '@/components/domain/PriorityBadge';
import { PriorityMatrix } from '@/components/domain/PriorityMatrix';
import { UserChip } from '@/components/domain/UserChip';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { useUsers } from '@/hooks/useCatalog';
import type { UpdateOrderInput } from '@/lib/api/apiClient';
import { IMPACTO_LABEL, ROL_LABEL, URGENCIA_LABEL } from '@/lib/domain/labels';
import { calculatePriority } from '@/lib/workflow/priority';
import { NIVELES_IMPACTO, NIVELES_URGENCIA, type Impacto, type OrdenResumen, type Urgencia } from '@/types/domain';

export interface AssignmentCardProps {
  order: OrdenResumen;
  canAssign: boolean;
  canReprioritize: boolean;
  busy?: boolean;
  onSave: (input: UpdateOrderInput) => Promise<unknown>;
}

export function AssignmentCard({ order, canAssign, canReprioritize, busy, onSave }: AssignmentCardProps) {
  const users = useUsers();
  const [editing, setEditing] = useState(false);
  const [responsableId, setResponsableId] = useState(order.responsableId);
  const [tecnicoId, setTecnicoId] = useState(order.tecnicoId ?? '');
  const [impacto, setImpacto] = useState<Impacto>(order.impacto);
  const [urgencia, setUrgencia] = useState<Urgencia>(order.urgencia);

  const editable = (canAssign || canReprioritize) && order.estado !== 'CERRADO';

  function startEdit() {
    setResponsableId(order.responsableId);
    setTecnicoId(order.tecnicoId ?? '');
    setImpacto(order.impacto);
    setUrgencia(order.urgencia);
    setEditing(true);
  }

  function save() {
    const input: UpdateOrderInput = {};
    if (canAssign && responsableId !== order.responsableId) input.responsableId = responsableId;
    if (canAssign && (tecnicoId || null) !== order.tecnicoId) input.tecnicoId = tecnicoId || null;
    if (canReprioritize && (impacto !== order.impacto || urgencia !== order.urgencia)) {
      input.impacto = impacto;
      input.urgencia = urgencia;
    }
    if (Object.keys(input).length === 0) {
      setEditing(false);
      return;
    }
    void onSave(input).then(() => setEditing(false), () => undefined);
  }

  return (
    <Card>
      <CardHeader
        as="h3"
        icon={<UserCog aria-hidden="true" />}
        title="Asignación y prioridad"
        actions={
          editable && !editing && (
            <Button variant="ghost" size="sm" leftIcon={<Pencil aria-hidden="true" />} onClick={startEdit}>
              Editar
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-4 p-4">
        {!editing ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Responsable</dt>
              <dd className="mt-1"><UserChip user={order.responsable} /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Técnico</dt>
              <dd className="mt-1"><UserChip user={order.tecnico} /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Impacto</dt>
              <dd className="mt-1 font-medium">{IMPACTO_LABEL[order.impacto]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Urgencia</dt>
              <dd className="mt-1 font-medium">{URGENCIA_LABEL[order.urgencia]}</dd>
            </div>
            <div className="col-span-2">
              <dt className="sr-only">Prioridad</dt>
              <dd><PriorityMatrix impacto={order.impacto} urgencia={order.urgencia} /></dd>
            </div>
          </dl>
        ) : (
          <>
            {canAssign && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  id="as-resp"
                  label="Responsable"
                  required
                  value={responsableId}
                  onChange={(e) => setResponsableId(e.target.value)}
                  options={(users.data ?? []).map((u) => ({ value: u.id, label: `${u.nombre} (${ROL_LABEL[u.rol]})` }))}
                />
                <Select
                  id="as-tec"
                  label="Técnico"
                  placeholder="Sin asignar"
                  value={tecnicoId}
                  onChange={(e) => setTecnicoId(e.target.value)}
                  options={(users.data ?? []).filter((u) => u.rol === 'TECNICO').map((u) => ({ value: u.id, label: u.nombre }))}
                />
              </div>
            )}
            {canReprioritize && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SegmentedControl
                    label="Impacto"
                    name="as-impacto"
                    options={NIVELES_IMPACTO.map((n) => ({ value: n, label: IMPACTO_LABEL[n] }))}
                    value={impacto}
                    onChange={setImpacto}
                  />
                  <SegmentedControl
                    label="Urgencia"
                    name="as-urgencia"
                    options={NIVELES_URGENCIA.map((n) => ({ value: n, label: URGENCIA_LABEL[n] }))}
                    value={urgencia}
                    onChange={setUrgencia}
                  />
                </div>
                <p className="flex items-center gap-2 text-sm" aria-live="polite">
                  Nueva prioridad: <PriorityBadge prioridad={calculatePriority(impacto, urgencia)} />
                </p>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button size="sm" loading={busy} leftIcon={<Save aria-hidden="true" />} onClick={save}>
                Guardar cambios
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
