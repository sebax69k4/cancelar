import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ClipboardList, Cpu, FlaskConical, Lock, LogIn, Mail, ShieldCheck, Wrench, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Toaster } from '@/components/ui/Toast';
import { firstUserWithRole, getMockCurrentUser, signInAs } from '@/lib/auth/mockCurrentUser';
import { cn } from '@/lib/cn';
import { ROL_LABEL } from '@/lib/domain/labels';
import { toast } from '@/lib/toast';
import { loginSchema, type LoginInput } from '@/schemas/login.schema';
import type { Rol } from '@/types/domain';

const ROLE_CARDS: readonly { rol: Rol; icon: LucideIcon; desc: string }[] = [
  { rol: 'ADMIN', icon: ShieldCheck, desc: 'Acceso completo' },
  { rol: 'SUPERVISOR', icon: ClipboardList, desc: 'Valida, cierra, bloquea, escala y reabre' },
  { rol: 'RECEPCION', icon: Mail, desc: 'Registra clientes, equipos y órdenes' },
  { rol: 'TECNICO', icon: Wrench, desc: 'Trabaja sus órdenes asignadas' },
];

function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export default function LoginPage() {
  useEffect(() => {
    if (getMockCurrentUser()) window.location.replace(safeNext());
  }, []);

  const {
    register, handleSubmit, setValue, watch, formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: firstUserWithRole('SUPERVISOR').email, password: 'demo1234', rol: 'SUPERVISOR' },
  });

  const rol = watch('rol');

  async function onSubmit(data: LoginInput) {
    await new Promise((r) => setTimeout(r, 400)); // latencia simulada
    const user = signInAs(firstUserWithRole(data.rol).id);
    if (!user) {
      toast.error('No se pudo iniciar sesión');
      return;
    }
    window.location.href = safeNext();
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca */}
      <aside className="relative hidden overflow-hidden bg-[#0b1220] p-10 text-slate-100 lg:flex lg:flex-col">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:32px_32px]"
        />
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-blue-500 text-[#0b1220]">
            <Cpu className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold">ServicioTécnico</span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl leading-tight font-semibold">Cada equipo, del ingreso a la entrega, sin perder el hilo.</h2>
          <ul className="mt-6 space-y-3 text-sm text-slate-300">
            <li className="flex gap-2"><span aria-hidden="true">→</span>Prioridad calculada por impacto y urgencia.</li>
            <li className="flex gap-2"><span aria-hidden="true">→</span>Flujo de estados con historial y comentarios.</li>
            <li className="flex gap-2"><span aria-hidden="true">→</span>Alertas de órdenes críticas abiertas más de 24 h.</li>
          </ul>
        </div>
      </aside>

      {/* Formulario */}
      <main className="relative flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-fg">
              <Cpu className="size-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold">ServicioTécnico</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
          <p className="mt-1 text-muted">Ingresá con tu cuenta del taller.</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="username"
              leftIcon={<Mail aria-hidden="true" />}
              required
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              id="password"
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              leftIcon={<Lock aria-hidden="true" />}
              required
              error={errors.password?.message}
              {...register('password')}
            />

            <fieldset className="rounded-lg border border-dashed border-amber-400 bg-amber-50/60 p-3 dark:border-amber-400/40 dark:bg-amber-400/5">
              <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold text-amber-900 dark:text-amber-200">
                <FlaskConical className="size-3.5" aria-hidden="true" />
                Rol de prueba (solo demo)
              </legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Rol de prueba">
                {ROLE_CARDS.map(({ rol: r, icon: Icon, desc }) => {
                  const checked = r === rol;
                  return (
                    <label
                      key={r}
                      className={cn(
                        'flex cursor-pointer flex-col gap-1 rounded-md border bg-surface p-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus',
                        checked ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-border-strong',
                      )}
                    >
                      <input
                        type="radio"
                        value={r}
                        className="sr-only"
                        {...register('rol', {
                          onChange: () => setValue('email', firstUserWithRole(r).email),
                        })}
                      />
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <Icon className={cn('size-4', checked ? 'text-primary' : 'text-muted')} aria-hidden="true" />
                        {ROL_LABEL[r]}
                      </span>
                      <span className="text-[11px] leading-snug text-muted">{desc}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <Button type="submit" size="lg" loading={isSubmitting} leftIcon={<LogIn aria-hidden="true" />}>
              Ingresar
            </Button>
            <p className="text-center text-xs text-muted">
              Demo sin autenticación real: cualquier contraseña de 4+ caracteres sirve.
            </p>
          </form>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
