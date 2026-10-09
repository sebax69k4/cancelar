import { FlaskConical } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { signInAs } from '@/lib/auth/mockCurrentUser';
import { ROL_LABEL } from '@/lib/domain/labels';
import { toast } from '@/lib/toast';
import { MOCK_USERS } from '@/mocks/users';

/** Selector temporal para probar permisos con cada rol mock. */
export function RoleSwitcher() {
  const user = useCurrentUser();
  if (!user) return null;

  return (
    <div className="relative flex items-center">
      <label htmlFor="role-switcher" className="sr-only">
        Usuario de prueba (cambia el rol)
      </label>
      <FlaskConical className="pointer-events-none absolute left-2.5 size-4 text-warning" aria-hidden="true" />
      <select
        id="role-switcher"
        value={user.id}
        onChange={(e) => {
          const next = signInAs(e.target.value);
          if (next) toast.info(`Ahora sos ${next.nombre}`, { description: `Rol de prueba: ${ROL_LABEL[next.rol]}` });
        }}
        className="h-9 max-w-52 cursor-pointer appearance-none truncate rounded-md border border-dashed border-amber-400 bg-amber-50 pr-3 pl-8 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200"
        title="Rol de prueba (solo demo)"
      >
        {MOCK_USERS.map((u) => (
          <option key={u.id} value={u.id}>
            {ROL_LABEL[u.rol]} · {u.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
