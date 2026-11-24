# ServicioTécnico — Backend (API REST)

API del sistema de workflow para el servicio técnico de PC y notebooks. Implementa el contrato que consume el frontend (`frontend/src/lib/api/httpApiClient.ts`): clientes, equipos, órdenes con su flujo de estados, evidencia, dashboard, alertas e informes de órdenes críticas.

**Stack:** NestJS 12 · TypeScript estricto · Prisma 7 · **PostgreSQL** · JWT en cookie HTTP-only · argon2 · class-validator · Swagger.

---

## Índice

1. [Puesta en marcha](#puesta-en-marcha)
2. [Primera cuenta](#primera-cuenta)
3. [Comandos](#comandos)
4. [Arquitectura](#arquitectura)
5. [Primer uso](#primer-uso)
6. [Escalamientos](#escalamientos)
7. [Endpoints](#endpoints)
8. [Seguridad](#seguridad)
9. [Pruebas](#pruebas)
10. [Antes de producción](#antes-de-producción)

---

## Puesta en marcha

Requisitos: Node.js ≥ 22, npm y **PostgreSQL 15 o superior**.

### Instalar PostgreSQL (Windows)

**En esta PC** está instalado en modo portable (sin servicio de Windows ni permisos de administrador): binarios de PostgreSQL 17 en `E:\PostgreSQL\17` y datos en `E:\PostgreSQL\data`, escuchando solo en `localhost:5432`. Para que arranque solo al entrar a Windows (crea un acceso directo oculto en la carpeta Inicio del usuario; no necesita administrador), corré una vez

```bash
npm run pg:autostart
```

`npm run pg:no-autostart` lo quita. Si no está activado, antes de levantar la API corré `npm run pg:start`. `npm run pg:stop` lo detiene y `npm run pg:status` muestra si está corriendo. Log: `E:\PostgreSQL\postgres.log`. Si se mueve la carpeta del proyecto, volvé a correr `pg:autostart` (el acceso directo apunta a este script).

**En otra PC**, cualquiera de estas opciones:

- Con permisos de administrador: el instalador de https://www.postgresql.org/download/windows/ (usuario `postgres`, puerto `5432`). Queda como servicio y no hacen falta los comandos `pg:*`.
- Sin permisos: descargá el zip «binaries» de PostgreSQL 17 desde https://www.enterprisedb.com/download-postgresql-binaries, descomprimilo de modo que quede `E:\PostgreSQL\17\bin\pg_ctl.exe` (el zip trae la carpeta `pgsql`, renombrala; para usar otra ubicación, definí las variables `PGHOME` y `PGDATA`) y creá los datos con una contraseña propia guardada en `clave.txt`:

  ```bash
  "E:\PostgreSQL\17\bin\initdb.exe" -D "E:\PostgreSQL\data" -U postgres --pwfile=clave.txt -E UTF8 --locale=C --auth=scram-sha-256
  ```

  Después borrá `clave.txt` y usá `npm run pg:start`.

En los dos casos poné la contraseña en `DATABASE_URL` de `.env`. No hace falta crear la base a mano: `prisma migrate deploy` crea `servicio_tecnico` si no existe.

### Backend

```bash
npm install
```

```bash
cp .env.example .env
```

Editá `.env`: en `DATABASE_URL` reemplazá `CONTRASENA` por la contraseña de PostgreSQL, y poné un `JWT_SECRET` aleatorio de al menos 32 caracteres. Para generarlo:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Creá la base y las tablas con las migraciones:

```bash
npx prisma migrate deploy
```

Levantá la API:

```bash
npm run start:dev
```

- API: http://localhost:3000/api
- Documentación interactiva (Swagger): http://localhost:3000/api/docs
- Estado: http://localhost:3000/api/health

### Conectar el frontend

En `frontend/.env`:

```env
PUBLIC_API_URL=http://localhost:3000/api
```

Reiniciá `npm run dev` en el frontend. La variable es obligatoria: sin ella el frontend no compila.

## Primera cuenta

La base arranca vacía: no hay usuarios ni contraseñas por defecto. Cada taller se crea desde la portada del frontend («Crear cuenta de taller»): quien la crea queda como Admin y el taller recibe el catálogo de 7 servicios. Después, el Admin agrega a las demás personas desde Configuración y asigna todos los roles antes de usar el sistema.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | API con recarga automática |
| `npm run build` / `npm run start:prod` | Compila a `dist/` y lo ejecuta |
| `npm run typecheck` | Chequeo de tipos (debe dar 0 errores) |
| `npm run lint` | oxlint (incluye `no-explicit-any`) |
| `npm test` | Pruebas unitarias de las reglas del workflow |
| `npm run test:e2e` | Prueba del ciclo completo en esquemas temporales de PostgreSQL (`e2e_*`) |
| `npm run db:migrate` | Crea una migración nueva tras cambiar `prisma/schema.prisma` (desarrollo) |
| `npm run db:deploy` | Aplica migraciones pendientes (producción) |
| `npm run db:reset` | **Borra la base** y la recrea vacía con las migraciones (solo desarrollo) |
| `npm run db:studio` | Prisma Studio: ver y editar datos en el navegador |

## Arquitectura

```text
prisma/
├── schema.prisma          Modelo de datos (Usuario, Cliente, Equipo, Servicio, Orden, Evidencia,
│                          Historial, InformeCritico, Contador)
└── migrations/            Migraciones SQL versionadas
src/
├── main.ts                Arranque + Swagger
├── setup.ts               Prefijo /api, helmet, cookies, CORS, ValidationPipe, filtro de errores
├── config/env.ts          Validación de variables de entorno (no arranca si falta algo)
├── prisma/                PrismaService y adapter.ts (conexión PostgreSQL, respeta ?schema=)
├── domain/                Reglas de negocio puras — copia fiel del frontend:
│   ├── permissions.ts       matriz rol → permisos
│   ├── priority.ts          matriz impacto × urgencia
│   ├── transitions.ts       transiciones y requisitos (canTransition, canBlock, closeChecklist…)
│   └── alerts.ts            horas abiertas, atraso, crítica > 24 h
├── common/                Mappers a DTO (forma de frontend/src/types/domain.ts), errores, filtro
├── auth/                  Login/logout/me, guard global (cookie o Bearer) y permisos por ruta
├── catalog/               GET /users, GET /services
├── clients/  equipment/   Alta y búsqueda
├── orders/                Órdenes, workflow, evidencia (archivos en UPLOAD_DIR)
├── dashboard/             Métricas, alertas, informes críticos + tarea programada
└── health/                GET /health
```

**Reglas del workflow.** Viven en `src/domain/` y son las mismas funciones que usa el frontend para explicar qué falta. **Si cambiás una regla, cambiala en los dos lados** (`frontend/src/lib/workflow/` y `frontend/src/lib/auth/permissions.ts`). Las pruebas unitarias (`src/domain/transitions.spec.ts`) cubren la matriz de prioridad y las transiciones.

**Transacciones.** Cada acción del workflow (cambio de estado, bloqueo, validación…) carga la orden, valida reglas, actualiza y registra el historial **en una sola transacción**: o se hace todo o nada.

**Búsqueda.** Clientes y equipos guardan columnas normalizadas (minúsculas, sin tildes, teléfono solo dígitos) para buscar sin distinguir mayúsculas ni acentos, y para detectar teléfonos duplicados aunque se escriban distinto.

**Informes críticos.** Se genera un `InformeCritico` por cada orden Crítica abierta hace más de 24 h, uno por cada día que siga abierta; «Revisado» se guarda por informe, así que al cumplir otro día vuelve a aparecer sin revisar. Al abrir el dashboard se crea al instante el informe del día si falta (sin reescribir los existentes, y tolerando que dos usuarios lo pidan a la vez); cada 10 minutos una tarea programada actualiza horas y último comentario de todos.

**Evidencia.** Se recibe por multipart (campo `file`), solo imágenes o PDF, hasta `UPLOAD_MAX_MB`. El archivo se valida y se escribe a disco recién después de verificar permisos; si la transacción falla, se borra. Para usar S3 u otro almacenamiento, reimplementar `src/orders/evidence.storage.ts`.

## Primer uso

1. La portada (`/`) ofrece **Crear cuenta de taller** e **Iniciar sesión**. Quien se registra en `/registro` crea un taller nuevo (con los 7 servicios iniciales) y queda como su **Admin**. Las demás personas del taller las agrega el Admin.
2. Hasta terminar `/configuracion` (datos del taller, una persona en cada rol esencial y al menos un servicio), el Admin no sale de esa pantalla, el resto ve un aviso y la API rechaza crear órdenes.
3. Roles esenciales: Supervisor, Recepción y Técnico. Una persona puede tener **varios roles** y suma los permisos de cada uno. Si después un rol queda sin nadie activo, el dashboard del Admin avisa.

**Varios talleres:** cualquiera puede registrar un taller nuevo desde la portada, sin límite de cantidad (el registro admite 10 por minuto por IP). Personas, clientes, equipos, servicios y órdenes tienen `tallerId`, y cada consulta se limita al taller del usuario: un dato de otro taller responde como inexistente (404) y no se puede usar para armar una orden. Teléfonos, números de serie y números de orden se repiten entre talleres sin conflicto, y cada taller numera sus órdenes desde 0001. El email es único en todo el sistema (con él se ingresa), así que una persona pertenece a un solo taller. `test/tenants.e2e-spec.ts` cubre el aislamiento y el registro sin límite. `GET /setup/status` solo dice si ya hay algún taller (no cuántos).

No hay envío de emails: el Admin le pasa la contraseña temporal a cada persona y, si alguien la olvida, le pone una nueva desde Configuración.

## Escalamientos

| Nivel | Atiende | Escalan a este nivel |
|---|---|---|
| 2 | Supervisor | Técnico (sus órdenes), Recepción (reclamo del cliente o plazo) |
| 3 | Admin | Supervisor |

Ciclo: **sin tomar → tomado → resuelto**. Lo atiende su nivel o uno superior, y puede subir de nivel. Una orden tiene como máximo uno abierto (índice parcial en la base) y **no se puede cerrar** hasta resolverlo.

| Resolución | Qué pasa con la orden |
|---|---|
| Continuar | Sigue, con reasignación de técnico opcional |
| En espera | Se bloquea con ese motivo |
| No reparable / Rechazado por el cliente | Pasa a «Listo para retirar» sin reparar. Exige diagnóstico, evidencia, informe (20+ caracteres) y constancia de aviso al cliente. Queda validada por quien resuelve |

**Automático** (tarea cada 10 minutos, `syncEscalations`; plazos en `ESCALATION_HOURS` de `src/domain/escalation.ts`): crítica abierta más de 24 h → nivel 2, más de 48 h → nivel 3; atrasada más de 24 h → nivel 2; bloqueada más de 48 h → nivel 2; nivel 2 sin tomar en 24 h → nivel 3. Una causa ya resuelta no se repite hasta que vuelve a pasar su plazo. Las órdenes en «Listo para retirar» no escalan.

**Entrega:** Recepción cierra la orden si está validada. Al cerrar queda el `resultado`: Reparado, No reparable, Rechazado por el cliente o Abandonado (solo Admin, tras 60 días sin retirar).

## Endpoints

Todas las rutas llevan el prefijo `/api` y requieren sesión, salvo `health`, `auth/login`, `auth/logout`, `auth/register` y `setup/status`. La referencia completa con ejemplos está en **Swagger** (`/api/docs`).

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/auth/login` · `/auth/logout` | público (login: máx. 5 intentos/min) |
| POST | `/auth/register` | público (crea un taller nuevo y su Admin; 10 por minuto y 20 por hora por IP) |
| POST | `/auth/password` | sesión |
| GET | `/setup/status` | público (si ya hay talleres registrados y si el registro está abierto) |
| GET | `/setup/mine` | sesión (si el taller del usuario terminó la configuración) |
| GET · PATCH · POST | `/setup/progress` · `/setup/taller` · `/setup/complete` · `/setup/users` · `/setup/services` | `users.manage` (Admin) |
| GET | `/auth/me` | sesión |
| GET | `/users` · `/services` | sesión |
| GET · POST | `/clients` | crear: `client.create` |
| GET · POST | `/equipment` | crear: `equipment.create` |
| GET | `/equipment/:id/orders` | sesión (Técnico: solo sus órdenes) |
| GET · POST | `/orders` | crear: `order.create` |
| GET · PATCH | `/orders/:id` | por campo (ver abajo) |
| POST | `/orders/:id/transitions` · `block` · `unblock` · `escalate` · `reopen` · `validate` · `abandon` | reglas del workflow |
| POST | `/orders/:id/escalation/take` · `raise` · `resolve` | nivel del escalamiento |
| POST · DELETE | `/orders/:id/evidence` · `/orders/:id/evidence/:evidenceId` | editar la orden |
| GET | `/orders/:id/evidence/:evidenceId/file` | ver la orden |
| GET | `/dashboard` · `/alerts` | sesión · `nav.alertas` |
| PATCH | `/critical-reports/:id/read` | ver la orden |

`PATCH /orders/:id`: diagnóstico y solución requieren poder editar la orden (Técnico asignado, Supervisor o Admin); técnico y responsable requieren `order.assign`; impacto y urgencia, Supervisor o Admin. La prioridad **siempre** la calcula el servidor.

### Formato de errores

```json
{ "statusCode": 422, "message": "No se puede mover a «Listo para retirar»", "details": ["Falta documentar la solución"] }
```

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos (`message` es la lista de errores de validación) |
| 401 | Sin sesión o sesión vencida |
| 403 | El rol no tiene permiso / la orden no es del técnico |
| 404 | No existe |
| 409 | Teléfono, número de serie, email o nombre de servicio repetido |
| 422 | Regla del workflow no cumplida (`details` = lo que falta) |
| 429 | Demasiadas solicitudes (login) |

### Validaciones de datos

Las reglas están en `src/domain/validation.ts` (copia en `frontend/src/lib/workflow/validation.ts`), y se aplican con los decoradores de `src/common/validators.ts`. El frontend las muestra campo por campo antes de enviar; el backend las vuelve a controlar siempre.

- **Nombres** (personas, clientes, taller, servicios; también marca y modelo): de 2 a **40 caracteres** (`MAX_TEXTO`), con al menos una letra. Solo letras, números, espacios y `. , ' & ( ) / + # _ -`, empezando con letra o número. Los espacios de adelante, de atrás y dobles se quitan; los caracteres invisibles se rechazan.
- **Textos libres** (falla, diagnóstico, solución, comentarios, motivos, informes, notas, dirección): admiten cualquier símbolo visible y emojis, pero tienen que tener palabras o números. Se quitan los caracteres invisibles, de control y los que invierten el texto, y los espacios de las puntas. Cada uno tiene su largo máximo (`MAX_FALLA`, `MAX_DETALLE`, `MAX_COMENTARIO`…).
- **En toda la API** (`common/safe-text.ts`): el carácter nulo, los caracteres rotos, las direcciones mal codificadas y los cuerpos muy anidados responden 400.
- **Número de serie**: letras, números y `- _ / .`, empezando con letra o número.
- **Teléfono**: solo números, espacios, `+` (al principio), `-` y paréntesis de a pares, de 6 a 15 dígitos. El del taller es opcional.
- **Email**: formato válido sin caracteres raros, hasta 40 caracteres, se guarda en minúsculas y sin espacios. Vale igual al ingresar.
- **Contraseña nueva**: de 8 a 40 caracteres, con letras y números; admite símbolos, pero no espacios en las puntas ni caracteres invisibles. Al ingresar se controlan el largo, las puntas y los invisibles. En el registro y en «Mi cuenta» hay que repetirla, y la nueva tiene que ser distinta de la actual.
- **Servicios**: el nombre no se repite dentro del taller (sin importar mayúsculas); el precio es un entero de 0 a 100.000.000.
- **Fecha estimada de la orden**: de hoy a 365 días, y tiene que existir (no el 30 de febrero).
- **Búsquedas**: hasta 100 caracteres.
- **Evidencias**: hasta **10 MB** por archivo (`MAX_EVIDENCIA_MB`). `UPLOAD_MAX_MB` en `.env` solo puede bajarlo: con un valor mayor a 10 el backend no arranca. Hasta 30 archivos por orden.
- **Subidas pesadas** (scripts por fuera del navegador): un pedido demasiado grande se corta sin recibirlo entero, con o sin `Content-Length` y con o sin sesión (`common/body-limit.ts`). El permiso sobre la orden se controla antes de leer el archivo, y cada persona puede subir 3 archivos a la vez, 30 por minuto y 150 por hora; en total, 6 a la vez (`orders/upload.guard.ts`). No se aceptan campos de texto ni un segundo archivo, y siempre quedan 100 MB libres en el disco.

## Seguridad

- Contraseñas con **argon2id**. El login tarda lo mismo exista o no el email.
- Sesión: JWT firmado en cookie **HTTP-only**, `SameSite=Lax`, `Secure` con `COOKIE_SECURE=true`. Duración: `JWT_EXPIRES_IN`. Solo se acepta **HS256**: un token con otro algoritmo, o con `none`, se rechaza.
- **Cerrar sesión invalida el token** (tabla `SesionCerrada`, por `jti`): si alguien lo copió, deja de servirle en ese momento. Las filas se borran solas cuando el token habría vencido.
- **CSRF** (`src/common/origin.ts`): `POST`, `PATCH` y `DELETE` solo se aceptan si `Origin` es `CORS_ORIGIN` o la propia API. Sin `Origin` (curl, pruebas) solo se rechaza si `Sec-Fetch-Site` dice `cross-site`. Complementa a `SameSite=Lax`, que no frena a otro puerto o subdominio del mismo sitio.
- **Producción** (`NODE_ENV=production`): el backend no arranca con `COOKIE_SECURE=false`, con orígenes sin `https://` ni con sesiones de más de 7 días.
- **Registro de seguridad** (logger `Seguridad`, una línea JSON por evento): logins fallidos y exitosos, tokens inválidos o cerrados reutilizados, accesos denegados (403), límites superados (429), orígenes rechazados, usuarios creados o modificados, cambios de contraseña y evidencias rechazadas. El email va oculto (`a***@dominio`) y nunca se registran contraseñas ni tokens. Al ser JSON, un valor con saltos de línea no puede inventar líneas falsas.
- Registro de talleres: 10 por minuto y 20 por hora por IP, para que nadie llene la base de talleres falsos.
- El usuario se vuelve a leer de la base en cada request: desactivar un usuario (`activo = false`) corta su acceso al instante.
- **Corte de sesiones** (`Usuario.sesionesDesde`): cambiar la propia contraseña cierra las demás sesiones (la actual recibe un token nuevo); el reseteo de contraseña por el Admin y la desactivación cierran todas, aunque después se reactive a la persona.
- **CORS** restringido a `CORS_ORIGIN` (se aceptan varios separados por coma).
- **helmet** (cabeceras de seguridad). Límite de solicitudes: 600/min por IP en general. Login: 5 intentos por minuto por **IP + email** (en un taller varias PCs comparten IP: contar solo por IP bloquearía a empleados legítimos) y además 20 por minuto por **IP**, sumando todas las cuentas, contra quien prueba una contraseña en muchas cuentas.
- **Archivos maliciosos** (`src/orders/evidence.signature.ts`). Solo se aceptan JPG, PNG, WebP, GIF, HEIC y PDF; SVG y HTML se rechazan porque pueden contener scripts. Cada archivo se revisa por dentro, sin confiar en el tipo que declara el navegador:
  - **Firma**: los primeros bytes tienen que ser los del tipo. Un HTML o un ejecutable renombrado como `.jpg` se rechaza.
  - **Estructura completa**: PNG terminado en `IEND`, GIF en `;`, WebP con el tamaño RIFF exacto, PDF con `%%EOF`. Así se frenan los «políglotas» (una foto válida con un ZIP o un programa pegado al final). En JPEG y HEIC no se controla, porque los celulares guardan datos legítimos después de la imagen.
  - **Sin código**: se rechaza si trae HTML, `<script>`, `<svg>`, `<iframe>`, PHP, `javascript:` o un ejecutable de Windows incrustado.
  - **PDF sin acciones**: se rechaza si trae `/JavaScript`, `/JS`, `/Launch`, adjuntos (`/EmbeddedFiles`), `/RichMedia`, formularios XFA o envío de formularios. También se buscan disfrazadas (`/J#61vaScript`) y escondidas en objetos comprimidos, que se descomprimen con un tope total de 20 MB contra las bombas zip.
  - **Guardado**: nombre aleatorio y extensión del tipo verificado, nunca la del nombre original (un `shell.php` se guarda `.jpg`), y nunca fuera de `UPLOAD_DIR`. El nombre visible se limpia de carpetas, saltos de línea y caracteres invisibles (por ejemplo, la inversión de texto que disfraza `fdp.exe`).
  - **Descarga aislada**: `Content-Security-Policy: default-src 'none'; sandbox` y `nosniff`, así que aunque algo se colara el navegador no ejecuta scripts ni accede a la sesión. Los PDF se descargan (`attachment`) en lugar de abrirse dentro del sitio.
- `ValidationPipe` con `whitelist`: los campos que no están en el DTO se descartan (ej. un `prioridad` enviado por el cliente).
- **Inyección SQL**. Todas las consultas pasan por Prisma, que manda los valores como parámetros separados del SQL: un `' OR 1=1 --` se busca o se guarda como texto. `src/common/sql.spec.ts` revisa el código y las pruebas, y falla si alguien agrega `$queryRawUnsafe`, `$executeRawUnsafe` o `Prisma.raw`. El SQL directo que queda usa plantillas con parámetros: el chequeo de salud y la secuencia de `Taller` en los datos de prueba. La limpieza de pruebas solo acepta esquemas `e2e_…` y los escapa con `escapeIdentifier`. Los comodines de `LIKE` (`%`, `_`) se escapan para que se busquen como texto. Las pruebas e2e mandan SQL en búsquedas, login, ids de la URL y datos.
- Errores: nunca devuelven trazas ni rutas internas; un cuerpo JSON demasiado grande responde 413.
- Documentación interactiva (`/api/docs`): solo fuera de producción (`NODE_ENV=production` la apaga).
- Dependencias: `npm audit --omit=dev` sin vulnerabilidades al 19/11/2026. Las que reporta `npm audit` completo son de herramientas de desarrollo (pruebas y compilación), que no se despliegan.

## Pruebas

```bash
npm test
```

```bash
npm run test:e2e
```

Necesitan PostgreSQL corriendo. Cada archivo usa su propio esquema (`e2e_workflow`, `e2e_edge`) dentro de la base de `TEST_DATABASE_URL` o, si no está definida, de `DATABASE_URL`; nunca toca `public`. Cada archivo borra y recrea su esquema, aplica migraciones y carga sus datos de prueba (`test/seed-pruebas.ts`, que solo corre en esquemas `e2e_…`). `security.e2e-spec.ts` cubre seguridad y validaciones: rutas sin sesión, tokens falsificados o vencidos, permisos por rol, campos que el cliente no debe controlar, inyección SQL y comodines, `__proto__`, HTML guardado como texto, firma y tamaño de archivos, `../` en nombres, cabeceras, errores sin detalles internos, corte de sesiones, fuerza bruta y los límites de cada campo. Al terminar, cada archivo borra su esquema y su carpeta de evidencias: no quedan datos de prueba. `escalation.e2e-spec.ts` cubre niveles, ciclo, sin reparación, entrega y escalamiento automático; `setup.e2e-spec.ts`, el primer uso, los varios roles y las validaciones de datos. `workflow.e2e-spec.ts` recorre con los cuatro roles: alta de cliente/equipo/orden, visibilidad del Técnico, reglas con 422, bloqueo y desbloqueo, escalado, evidencia con archivo real, validación, cierre, reapertura, historial completo, crítica > 24 h en el dashboard y límite de intentos de login.

## Antes de producción

- `JWT_SECRET` nuevo y largo; `COOKIE_SECURE=true` detrás de HTTPS; `CORS_ORIGIN` con el dominio real; `NODE_ENV=production`.
- Cabeceras de seguridad para el frontend en el servidor web o proxy (casi todas sus páginas son estáticas): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` y HSTS.
- No hay usuarios por defecto: la primera cuenta se crea desde la portada.
- Respaldos periódicos de PostgreSQL (`pg_dump`) y de `UPLOAD_DIR`. Un usuario de base propio para la app en lugar de `postgres`.
- `npm run build` y `npm run db:deploy` en el servidor; ejecutar con `npm run start:prod` (o un gestor de procesos). Pasos completos en `../DEPLOY.md`.
