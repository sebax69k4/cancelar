import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useUsers } from '@/hooks/useCatalog';
import type { ResolveEscalationInput } from '@/lib/api/apiClient';
import { RESOLUCION_LABEL } from '@/lib/domain/labels';
import { MIN_INFORME, RESOLUCIONES_SIN_REPARACION, sinReparacionMissing } from '@/lib/workflow/escalation';
import { MIN_MOTIVO } from '@/lib/workflow/transitions';
import { RESOLUCIONES, type OrdenResumen, type ResolucionEscalamiento } from '@/types/domain';

export interface ResolveEscalationModalProps {
  order: OrdenResumen;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (input: ResolveEscalationInput) => void;
}

const HINT: Record<ResolucionEscalamiento, string> = {
  CONTINUAR: 'Hay un camino: la orden sigue con el técnico (o con otro).',
  EN_ESPERA: 'Falta un repuesto, un proveedor o una respuesta. La orden se bloquea; si pasan 48 h, vuelve a escalar.',
  NO_REPARABLE: 'Daño irreversible, sin repuesto o no conviene repararlo. La orden pasa a «Listo para retirar» sin reparar.',
  RECHAZADO_CLIENTE: 'El cliente no aprueba el presupuesto o pide el equipo como está. Se entrega sin reparar.',
};

/** Resolver el escalamiento: qué pasa con la orden y, si no se repara, lo que hay que dejar asentado. */
export function ResolveEscalationModal({ order, open, busy, onClose, onConfirm }: ResolveEscalationModalProps) {
  const users = useUsers();
  const [resolucion, setResolucion] = useState<ResolucionEscalamiento>('CONTINUAR');
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');

  useEffect(() => {
    if (!open) return;
    setResolucion('CONTINUAR');
    setTexto('');
    setAviso('');
    setTecnicoId('');
  }, [open]);

  const sinReparar = RESOLUCIONES_SIN_REPARACION.includes(resolucion);
  const faltan = sinReparar
    ? sinReparacionMissing(order, texto, aviso)
    : texto.trim().length < MIN_MOTIVO ? [`Falta el detalle (mínimo ${MIN_MOTIVO} caracteres)`] : [];
  const tecnicos = (users.data ?? []).filter((u) => u.roles.includes('TECNICO') && u.id !== order.tecnicoId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={`Resolver escalamiento de ${order.numero}`}
      description="Elegí qué pasa con la orden. Queda en el historial."
      icon={<CheckCircle2 className="text-success" aria-hidden="true" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            loading={busy}
            disabled={faltan.length > 0}
            onClick={() =>
              onConfirm({
                resolucion,
                texto: texto.trim(),
                tecnicoId: resolucion === 'CONTINUAR' && tecnicoId ? tecnicoId : undefined,
                avisoCliente: sinReparar ? aviso.trim() : undefined,
              })
            }
          >
            Resolver
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          id="resolver-resultado"
          label="Resultado"
          required
          value={resolucion}
          hint={HINT[resolucion]}
          onChange={(e) => setResolucion(e.target.value as ResolucionEscalamiento)}
          options={RESOLUCIONES.map((r) => ({ value: r, label: RESOLUCION_LABEL[r] }))}
        />
        {resolucion === 'CONTINUAR' && (
          <Select
            id="resolver-tecnico"
            label="Reasignar técnico"
            placeholder="Sigue el técnico actual"
            value={tecnicoId}
            onChange={(e) => setTecnicoId(e.target.value)}
            options={tecnicos.map((u) => ({ value: u.id, label: u.nombre }))}
          />
        )}
        <Textarea
          id="resolver-texto"
          label={sinReparar ? 'Informe de no reparación' : 'Detalle'}
          required
          rows={4}
          data-autofocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={sinReparar ? 'Por qué no se repara y qué opciones se le dieron al cliente.' : 'Qué se decidió y cómo sigue.'}
          hint={`Mínimo ${sinReparar ? MIN_INFORME : MIN_MOTIVO} caracteres.`}
        />
        {sinReparar && (
          <Textarea
            id="resolver-aviso"
            label="Constancia de aviso al cliente"
            required
            rows={2}
            value={aviso}
            onChange={(e) => setAviso(e.target.value)}
            placeholder="Ej.: Llamó Martín el 3/11 a las 10:30, habló con Juan Pérez."
          />
        )}
        {sinReparar && faltan.length > 0 && (
          <div role="status" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <ul className="list-disc pl-4">
              {faltan.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
