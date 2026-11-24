import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Building2, Lock, Mail, UserPlus, UserRound } from 'lucide-react';
import { Button, LinkButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/api/apiClient';
import { signUp } from '@/lib/auth/session';
import { MAX_TEXTO } from '@/lib/workflow/validation';
import { PASSWORD_HINT } from '@/schemas/common';
import { registerSchema, type RegisterInput } from '@/schemas/login.schema';
import { LoginLayout } from './LoginPage';

/** Primera cuenta del sistema: crea el taller y su Admin, y lleva a la configuración inicial. */
export default function RegisterPage() {
  // null mientras se consulta; false si ya no hay lugar para otro taller
  const [abierto, setAbierto] = useState<boolean | null>(null);

  useEffect(() => {
    void apiClient.getSetupStatus().then((s) => setAbierto(s.registroAbierto), () => setAbierto(true));
  }, []);

  const {
    register, handleSubmit, setError, formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { tallerNombre: '', nombre: '', email: '', password: '', confirmar: '' },
  });

  async function onSubmit(data: RegisterInput) {
    const res = await signUp({ tallerNombre: data.tallerNombre, nombre: data.nombre, email: data.email, password: data.password });
    if (!res.ok) {
      setError('root', { message: res.message });
      return;
    }
    window.location.href = '/configuracion';
  }

  if (abierto === false) {
    return (
      <LoginLayout
        title="Crear cuenta"
        subtitle="El registro de talleres nuevos está cerrado por el momento."
      >
        <div className="mt-8">
          <LinkButton href="/login">Ir a iniciar sesión</LinkButton>
        </div>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout
      title="Crear cuenta de taller"
      subtitle="Vas a ser el Admin del taller. Antes de usar el sistema vas a tener que asignar todos los roles: Supervisor, Recepción y Técnico."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
        {errors.root?.message && (
          <p role="alert" className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {errors.root.message}
          </p>
        )}
        <Input id="tallerNombre" label="Nombre del taller" autoFocus required maxLength={MAX_TEXTO} leftIcon={<Building2 aria-hidden="true" />} error={errors.tallerNombre?.message} {...register('tallerNombre')} />
        <Input id="nombre" label="Tu nombre" autoComplete="name" required maxLength={MAX_TEXTO} leftIcon={<UserRound aria-hidden="true" />} error={errors.nombre?.message} {...register('nombre')} />
        <Input id="email" label="Email" type="email" autoComplete="username" required leftIcon={<Mail aria-hidden="true" />} error={errors.email?.message} {...register('email')} />
        <Input id="password" label="Contraseña" type="password" autoComplete="new-password" required hint={PASSWORD_HINT} leftIcon={<Lock aria-hidden="true" />} error={errors.password?.message} {...register('password')} />
        <Input id="confirmar" label="Repetí la contraseña" type="password" autoComplete="new-password" required leftIcon={<Lock aria-hidden="true" />} error={errors.confirmar?.message} {...register('confirmar')} />
        <Button type="submit" size="lg" loading={isSubmitting} disabled={abierto === null} leftIcon={<UserPlus aria-hidden="true" />}>
          Crear cuenta
        </Button>
        <p className="text-center text-sm text-muted">
          ¿Ya tenés cuenta? <a href="/login" className="font-semibold text-primary hover:underline">Iniciar sesión</a>
        </p>
      </form>
    </LoginLayout>
  );
}
