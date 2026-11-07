import { useEffect, useState } from 'react';
import { ArrowUpCircle } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { CAUSA_LABEL } from '@/lib/domain/labels';
import { CAUSAS_MANUALES, CAUSAS_RECEPCION, escalationTarget } from '@/lib/workflow/escalation';
import { MIN_MOTIVO, canActOnOrder } from '@/lib/workflow/transitions';
import type { CausaEscalamiento, OrdenResumen, Usuario } from '@/types/domain';
import { ReasonModal } from './ReasonModal';

export interface EscalateModalProps {
  order: OrdenResumen;
  user: Usuario;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (v: { causa: CausaEscalamiento; motivo: string }) => void;
}

/** Escalar: elige la causa y deja el motivo. El nivel de destino sale del rol de quien escala. */
export function EscalateModal({ order, user, open, busy, onClose, onConfirm }: EscalateModalProps) {
  const [causa, setCausa] = useState<CausaEscalamiento | ''>('');
  useEffect(() => {
    if (open) setCausa('');
  }, [open]);

  const causas = canActOnOrder(user, order, 'escalate') ? CAUSAS_MANUALES : CAUSAS_RECEPCION;
  const nivel = escalationTarget(order, user) ?? 2;

  return (
    <ReasonModal
      open={open}
      onClose={onClose}
      busy={busy}
      title={`Escalar ${order.numero}`}
      description={`Pasa a nivel ${nivel} (${nivel === 3 ? 'Admin' : 'Supervisor'}) y queda en Alertas hasta que lo resuelvan.`}
      icon={<ArrowUpCircle className="text-warning" aria-hidden="true" />}
      label="Motivo del escalado"
      placeholder="Ej.: Falla intermitente de placa, no se encuentra la causa."
      minLength={MIN_MOTIVO}
      confirmLabel="Escalar"
      confirmDisabled={!causa}
      onConfirm={(motivo) => {
        if (causa) onConfirm({ causa, motivo });
      }}
    >
      <Select
        id="escalar-causa"
        label="Causa"
        required
        placeholder="Elegí la causa"
        value={causa}
        onChange={(e) => setCausa(e.target.value as CausaEscalamiento | '')}
        options={causas.map((c) => ({ value: c, label: CAUSA_LABEL[c] }))}
      />
    </ReasonModal>
  );
}
