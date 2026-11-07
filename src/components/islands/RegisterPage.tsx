import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Building2, Lock, Mail, UserPlus, UserRound } from 'lucide-react';
import { Button, LinkButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/api/apiClient';
import { isMockApi } from '@/lib/api/config';
import { signUp } from '@/lib/auth/mockCurrentUser';
import { registerSchema, type RegisterInput } from '@/schemas/login.schema';
import { LoginLayout } from './LoginPage';

/** Primera cuenta del sistema: crea el taller y su Admin, y lleva a la configuración inicial. */
export default function RegisterPage() {
  const [taken, setTaken] = useState(isMockApi);

  useEffect(() => {
    if (isMockApi) return;
    void apiClient.getSetupStatus().then((s) => setTaken(s.cuentaCreada), () => undefined);
  }, []);

  const {
    register, handleSubmit, setError, formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { tallerNombre: '', nombre: '', email: '', password: '' },
  });

  async function onSubmit(data: RegisterInput) {
    const res = await signUp(data);
    if (!res.ok) {
      setError('root', { message: res.message });
      return;
    }
    window.location.href = '/configuracion';
  }

  if (taken) {
    return (
      <LoginLayout title="Crear cuenta" subtitle="Este sistema ya tiene una cuenta. Pedile acceso al Admin del taller.">
        <div className="mt-8">
          <LinkButton href="/login">Ir a iniciar sesión</LinkButton>
        </div>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout title="Crear cuenta" subtitle="Vas a ser el Admin del taller. Después definís quién cumple cada rol.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
        {errors.root?.message && (
          <p role="alert" className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {errors.root.message}
          </p>
        )}
        <Input id="tallerNombre" label="Nombre del taller" autoFocus required leftIcon={<Building2 aria-hidden="true" />} error={errors.tallerNombre?.message} {...register('tallerNombre')} />
        <Input id="nombre" label="Tu nombre" autoComplete="name" required leftIcon={<UserRound aria-hidden="true" />} error={errors.nombre?.message} {...register('nombre')} />
        <Input id="email" label="Email" type="email" autoComplete="username" required leftIcon={<Mail aria-hidden="true" />} error={errors.email?.message} {...register('email')} />
        <Input id="password" label="Contraseña" type="password" autoComplete="new-password" required hint="Mínimo 8 caracteres." leftIcon={<Lock aria-hidden="true" />} error={errors.password?.message} {...register('password')} />
        <Button type="submit" size="lg" loading={isSubmitting} leftIcon={<UserPlus aria-hidden="true" />}>
          Crear cuenta
        </Button>
      </form>
    </LoginLayout>
  );
}
