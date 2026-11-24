import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Cpu, Lock, LogIn, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Toaster } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/apiClient';
import { loadSession, signInWithPassword } from '@/lib/auth/session';
import { loginSchema, type LoginInput } from '@/schemas/login.schema';

/**
 * Adónde volver después de iniciar sesión: solo páginas de este mismo sitio. Sin esto, un link
 * como /login?next=/\otro-sitio.com (el navegador toma «/\» como «//») llevaría a una página
 * falsa justo después de que la persona puso su contraseña.
 */
export function safeNext(search: string = window.location.search, origin: string = window.location.origin): string {
  const next = new URLSearchParams(search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\p{Cc}]/u.test(next)) return '/dashboard';
  try {
    const url = new URL(next, origin);
    return url.origin === origin ? url.pathname + url.search + url.hash : '/dashboard';
  } catch {
    return '/dashboard';
  }
}

/** Inicio de sesión contra el backend (cookie HTTP-only). */
export default function LoginPage() {
  useEffect(() => {
    void loadSession().then((u) => {
      if (u) window.location.replace(safeNext());
    });
    // Sistema recién instalado: todavía no hay con qué entrar
    void apiClient.getSetupStatus().then((s) => {
      if (!s.hayTalleres) window.location.replace('/registro');
      else setRegistroAbierto(s.registroAbierto);
    }, () => undefined);
  }, []);
  // Visible salvo que el servidor diga que el registro está cerrado (no depende de que conteste rápido)
  const [registroAbierto, setRegistroAbierto] = useState(true);

  const {
    register, handleSubmit, setError, formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  async function onSubmit(data: LoginInput) {
    const res = await signInWithPassword(data.email, data.password);
    if (!res.ok) {
      setError('root', { message: res.message });
      return;
    }
    window.location.href = safeNext();
  }

  return (
    <LoginLayout subtitle="Ingresá con tu cuenta del taller.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
        {errors.root?.message && (
          <p role="alert" className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {errors.root.message}
          </p>
        )}
        <Input
          id="email"
          label="Email"
          type="email"
          autoComplete="username"
          autoFocus
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
        <Button type="submit" size="lg" loading={isSubmitting} leftIcon={<LogIn aria-hidden="true" />}>
          Ingresar
        </Button>
        {registroAbierto && (
          <p className="text-center text-sm text-muted">
            ¿Taller nuevo? <a href="/registro" className="font-semibold text-primary hover:underline">Crear cuenta</a>
          </p>
        )}
        <p className="text-center text-xs">
          <a href="/" className="text-muted hover:underline">Volver a la portada</a>
        </p>
      </form>
    </LoginLayout>
  );
}

/** Marco común de la página de login (panel de marca + formulario). */
export function LoginLayout({ title = 'Iniciar sesión', subtitle, children }: { title?: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
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
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-muted">{subtitle}</p>
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
