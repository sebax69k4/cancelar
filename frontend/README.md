# ServicioTécnico — Frontend

Frontend del sistema de workflow para un servicio técnico de PC y notebooks: recepción de equipos, órdenes de servicio, tablero Kanban, prioridad por impacto × urgencia, alertas de órdenes críticas y cierre con solución, evidencia y validación.

Trabaja siempre contra el backend NestJS (`../backend`): los datos viven en PostgreSQL y el login es real (cookie HTTP-only). La dirección del backend va en `PUBLIC_API_URL` y es **obligatoria**: sin ella el frontend no compila.

---

## Índice

1. [Stack](#stack)
2. [Puesta en marcha](#puesta-en-marcha)
3. [Roles y permisos](#roles-y-permisos)
4. [Reglas del workflow](#reglas-del-workflow)
5. [Estructura del proyecto](#estructura-del-proyecto)
6. [Comunicación con el backend](#comunicación-con-el-backend)
7. [Accesibilidad](#accesibilidad)

---

## Stack

| Tecnología | Uso |
|---|---|
| Astro 7 + `@astrojs/node` | Rutas y layout. La ruta `/ordenes/[id]` es dinámica (`prerender = false`). |
| React 19 (islas `client:only`) | Toda la interfaz interactiva. |
| TypeScript estricto | `strict` + `noUncheckedIndexedAccess`. Sin `any`. |
| Tailwind CSS 4 | Tokens de diseño en `src/styles/global.css` (modo claro/oscuro). |
| TanStack Query | Caché y estados de carga/error de las llamadas a `apiClient`. |
| react-hook-form + zod | Formularios y validaciones (`src/schemas`). |
| @dnd-kit | Kanban con arrastrar y soltar (mouse, táctil y teclado). |
| lucide-react | Iconografía. |

## Puesta en marcha

Requisitos: **Node.js ≥ 22.12** y npm, y el backend corriendo (ver `../backend/README.md`).

```bash
npm install
```

Copiá `.env.example` a `.env` y poné la dirección de la API (en desarrollo, `PUBLIC_API_URL=http://localhost:3000/api`).

```bash
npm run dev
```

Abre http://localhost:4321. También se puede iniciar en segundo plano con `npx astro dev --background` (y `npx astro dev stop` para detenerlo).

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente. |
| `npm run check` | Chequeo de tipos de TypeScript y Astro (debe dar 0 errores). |
| `npm run build` | Compila para producción en `dist/` (servidor Node standalone). |
| `npm run preview` | Sirve el build de producción localmente. |

Para producción, `PUBLIC_API_URL` se fija **al compilar** (queda dentro del build). Después:

```bash
node dist/server/entry.mjs
```

Escucha en `HOST`/`PORT` (por defecto `localhost:4321`). Los pasos completos de publicación están en `../DEPLOY.md`.

**Primer uso:** en `/` se crea la cuenta del taller (quien la crea queda como Admin). Antes de usar el sistema hay que asignar todos los roles en Configuración.

**Atajo:** `/` enfoca la búsqueda global.

## Roles y permisos

Matriz de permisos en `src/lib/auth/permissions.ts` (el backend tiene la misma en `backend/src/domain/permissions.ts`).

| Acción | Admin | Supervisor | Recepción | Técnico |
|---|:-:|:-:|:-:|:-:|
| Ver dashboard y órdenes | ✔ | ✔ | ✔ | solo las suyas |
| Clientes (ver / crear) | ✔ | ✔ | ✔ | — |
| Equipos (ver / crear) | ✔ | ✔ | ✔ | ver |
| Crear orden y asignar | ✔ | ✔ | ✔ | — |
| Cambiar estado | ✔ | ✔ | solo Recibido → Diagnóstico | solo las suyas |
| Diagnóstico, solución y evidencia | ✔ | ✔ | — | solo las suyas |
| Cambiar impacto y urgencia | ✔ | ✔ | — | — |
| Bloquear | ✔ | ✔ | — | solo las suyas |
| Escalar | no (último nivel) | a nivel 3 | a nivel 2: reclamo o plazo | a nivel 2: solo las suyas |
| Atender escalamientos | nivel 2 y 3 | nivel 2 | — | — |
| Desbloquear, validar y reabrir | ✔ | ✔ | — | — |
| Cerrar (entregar) | ✔ | ✔ | ✔ (si está validada) | — |
| Marcar equipo abandonado | ✔ | — | — | — |
| Alertas | ✔ | ✔ | ✔ | solo las suyas |
| Configuración (taller, personas, servicios) | ✔ | — | — | — |

«Las suyas» = órdenes donde el usuario es técnico asignado o responsable. Una persona puede tener varios roles y suma los permisos de cada uno.

## Reglas del workflow

Las reglas son **funciones puras** en `src/lib/workflow/`: la UI las usa para explicar qué falta antes de enviar. El backend tiene las mismas (`backend/src/domain/`) y es el que decide: si cambiás una regla, cambiala en los dos lados.

### Prioridad (`priority.ts`)

| Impacto \ Urgencia | Baja | Media | Alta |
|---|---|---|---|
| **Alto** | Media | Alta | **Crítica** |
| **Medio** | Media | Media | Alta |
| **Bajo** | Baja | Media | Media |

### Transiciones (`transitions.ts`)

Todo cambio exige **comentario** (mín. 5 caracteres). Una orden **bloqueada** no cambia de estado.

| Desde → Hacia | Requisito adicional |
|---|---|
| Recibido → En diagnóstico | Técnico asignado |
| En diagnóstico → En reparación | Diagnóstico cargado |
| En reparación → Pruebas / ← En diagnóstico | — |
| Pruebas → Listo para retirar | Solución documentada |
| Pruebas → En reparación (retroceso) | — |
| Listo para retirar → Cerrado | Solución + ≥ 1 evidencia + validación de supervisor, sin escalamiento abierto; rol Recepción, Supervisor o Admin |
| Cerrado → (Reabrir) Diagnóstico o Reparación | Motivo (mín. 10); rol Supervisor/Admin. Se pierde la validación. |

Acciones especiales: **Bloquear** y **Escalar** (motivo mín. 10), **Desbloquear** (comentario), **Validar** (requiere solución). Cambiar la solución o quitar evidencia invalida la validación. No se puede cerrar con un escalamiento abierto. El detalle de niveles, resoluciones («sin reparación») y escalamiento automático está en `backend/README.md`; las reglas, en `src/lib/workflow/escalation.ts`.

### Alertas (`alerts.ts`)

- **Crítica vencida**: prioridad Crítica, no cerrada y abierta hace más de **24 h**. Genera un informe crítico (aparece en el dashboard hasta marcarlo como revisado; vuelve a aparecer cada 24 h si sigue abierta).
- **Atrasada**: pasó la fecha estimada y no está lista ni cerrada.

## Estructura del proyecto

```text
src/
├── pages/                 Rutas Astro (solo montan la isla de cada página)
│   ├── index.astro (portada)  login.astro  registro.astro  dashboard.astro  alertas.astro …
│   └── ordenes/  index.astro (Kanban)  nueva.astro  [id].astro (detalle)
├── layouts/BaseLayout.astro   <html>, fuentes y script de tema sin parpadeo
├── components/
│   ├── ui/                Genéricos: Button, Input, Select, Modal, Toast, Tabs, Table, States…
│   ├── layout/            AppShell, Sidebar, Topbar, ClassicChrome
│   ├── auth/              PermissionGuard
│   ├── domain/            StatusBadge, PriorityBadge, OrderCard, kanban/, order/, client/, equipment/, dashboard/
│   └── islands/           Un componente raíz por página
├── hooks/                 useOrders, useOrder, useClients, useEquipment, useDashboard…
├── lib/
│   ├── api/               apiClient.ts (interfaz), httpApiClient.ts (fetch), config.ts, errors.ts, queryClient.ts
│   ├── workflow/          priority.ts, transitions.ts, alerts.ts, escalation.ts  ← reglas de negocio
│   ├── auth/              session.ts (sesión con el backend), permissions.ts
│   └── format.ts  theme.ts  toast.ts  storage.ts  router.ts
├── schemas/               zod: cliente, equipo, orden, transición, login
└── types/domain.ts        Tipos de dominio = contrato con el backend
```

**Regla de dependencias:** `components → hooks → lib/api/apiClient`. Ningún componente llama a `fetch` directamente.

### Patrones de experiencia de uso

| Patrón | Dónde | Para qué |
|---|---|---|
| **Línea de etapas** del flujo | `components/domain/order/WorkflowStepper.tsx` | Ver de un vistazo en qué etapa está la orden, cuáles pasó y cuáles faltan. |
| **Siguiente paso** con requisitos | `components/domain/order/NextStepCard.tsx` | Muestra qué falta para avanzar y lleva directo a resolverlo («Cargar», «Adjuntar», «Validar»). |
| **Mi trabajo** por rol | `components/domain/dashboard/MyWorkPanel.tsx` | Colas de lo que cada rol tiene que hacer. |
| **Nueva orden** fija en el menú | `components/layout/Sidebar.tsx` | La acción más frecuente siempre a un clic. |
| **Búsqueda instantánea** | `components/layout/GlobalSearch.tsx` | Resultados de órdenes y clientes mientras se escribe; ↑ ↓ Enter, «/» para enfocar. |
| **Vista Tablero / Lista** | `islands/OrdersBoardPage.tsx`, `components/domain/OrdersTable.tsx` | El tablero para el flujo; la lista para revisar muchas órdenes. |

### Navegación sin recargas

Todas las pantallas internas cargan la misma isla, `src/components/islands/App.tsx`, que elige la pantalla según la URL (`src/lib/router.ts`). Al hacer clic en un enlace interno cambia el contenido **sin recargar la página**: la sesión y los datos ya descargados se conservan.

- Al pasar el mouse o el foco por un enlace se precargan los datos de esa pantalla (`src/lib/api/prefetch.ts`).
- Recargar, abrir en pestaña nueva, atrás/adelante y compartir la URL funcionan igual.
- Para navegar desde código usá `navigate('/ruta')` de `src/lib/router.ts`.
- Una ruta nueva se agrega en `resolve()` de `App.tsx`, en `APP_ROUTE` de `router.ts` y como página `.astro` que monta `<App client:only="react">`.

### Estilos visuales

Dos estilos, combinables con el tema claro/oscuro (botones de la barra superior):

| Estilo | Claro | Oscuro |
|---|---|---|
| **Clásico** (por defecto) | Windows 2000: biseles, barras de título, barra de estado | Terminal CRT verde fósforo |
| **Moderno** | Interfaz plana clara | Interfaz plana oscura |

`<html>` lleva la clase `skin-classic`, que redefine los tokens de `global.css`. Los componentes exponen clases semánticas `ui-*` que el bloque «ESTILO CLÁSICO» de `global.css` convierte en biseles; para estilos puntuales existe la variante `classic:`. El navegador solo guarda estas preferencias (`st.theme`, `st.skin`); los datos viven en el servidor.

## Comunicación con el backend

La UI nunca llama a `fetch` directamente: todo pasa por la interfaz `ApiClient` (`src/lib/api/apiClient.ts`), implementada por `HttpApiClient`.

- **Sesión**: `/login` usa `POST /auth/login`; la sesión se recupera al cargar cada página con `GET /auth/me` (`src/lib/auth/session.ts`). Si el backend responde 401 (sesión vencida), se vuelve al login.
- **Portada y talleres**: `/` es la portada pública (crear cuenta de taller o iniciar sesión). Cada taller ve solo sus datos.
- **Evidencia**: el archivo se sube como multipart (fotos o PDF, máx. 10 MB) y el nombre en la lista lo abre.

### Formato de errores

`HttpApiClient` convierte las respuestas de error en `ApiError` y muestra `details` como lista en el toast:

| HTTP | Código en el front | Cuándo |
|---|---|---|
| 400 | `VALIDATION` | Datos inválidos (`message: string[]`) |
| 401 | `UNAUTHORIZED` | Sin sesión o sesión vencida |
| 403 | `FORBIDDEN` | Rol sin permiso |
| 404 | `NOT_FOUND` | No existe |
| 409 | `CONFLICT` | Teléfono o número de serie repetido |
| 422 | `WORKFLOW_RULE` | Regla del workflow no cumplida |

## Accesibilidad

- Contraste WCAG AA en modo claro y oscuro. Estados, prioridades y alertas siempre con **icono + texto**, nunca solo color.
- Foco visible en todos los controles y enlace «Saltar al contenido».
- Kanban por teclado: enfocá el asa de la tarjeta, **Espacio** para tomar, **← →** para cambiar de columna y **Espacio** para soltar. Alternativa: botón **Mover** en cada tarjeta.
- Modales sobre `<dialog>` nativo (foco atrapado, Esc, retorno de foco). Toasts en regiones `aria-live`.
- Respeta `prefers-reduced-motion`.
