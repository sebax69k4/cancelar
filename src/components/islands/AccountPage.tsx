import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { apiClient } from '@/lib/api/apiClient';
import { isMockApi } from '@/lib/api/config';
import { rolesLabel } from '@/lib/domain/labels';
import { notifyError } from '@/lib/notify';
import { toast } from '@/lib/toast';
import { changePasswordSchema, type ChangePasswordInput } from '@/schemas/login.schema';

function Content() {
  const user = useCurrentUser();
  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), defaultValues: { actual: '', nueva: '' } });

  async function onSubmit(data: ChangePasswordInput) {
    try {
      await apiClient.changePassword(data.actual, data.nueva);
      toast.success('Contraseña actualizada');
      reset();
    } catch (e) {
      notifyError(e);
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader icon={<KeyRound aria-hidden="true" />} title="Cambiar contraseña" description={user ? `${user.email} · ${rolesLabel(user.roles)}` : undefined} />
      <CardBody>
        {isMockApi ? (
          <p className="text-sm text-muted">En la demo no hay contraseñas reales.</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Input id="actual" label="Contraseña actual" type="password" autoComplete="current-password" required error={errors.actual?.message} {...register('actual')} />
            <Input id="nueva" label="Contraseña nueva" type="password" autoComplete="new-password" required hint="Mínimo 8 caracteres." error={errors.nueva?.message} {...register('nueva')} />
            <div>
              <Button type="submit" loading={isSubmitting}>Guardar</Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

export default function AccountPage() {
  return (
    <AppShell currentPath="/cuenta" title="Mi cuenta">
      <Content />
    </AppShell>
  );
}
