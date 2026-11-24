# Deploy de ServicioTécnico

Guía para publicar el sistema en un servidor. Son dos aplicaciones Node y una base PostgreSQL:

| Parte | Carpeta | Qué es | Puerto local |
|---|---|---|---|
| Backend (API) | `backend/` | NestJS + Prisma | 3000 |
| Frontend | `frontend/` | Astro (servidor Node) | 4321 |
| Base de datos | — | PostgreSQL 15 o superior | 5432 |

Las **credenciales** (contraseña de la base y `JWT_SECRET`) van en `backend/.env.production`. Ese archivo **no está en el repositorio**: te lo pasa el dueño del proyecto por un medio privado. No lo subas a git ni lo pegues en chats públicos.

---

## Antes de empezar: dominios

El frontend y la API tienen que estar **bajo el mismo dominio**, con HTTPS. Por ejemplo:

- Frontend: `https://taller.com`
- API: `https://api.taller.com`

La sesión viaja en una cookie `SameSite=Lax`: si el frontend y la API quedan en dominios distintos (por ejemplo `app.onrender.com` y `api.onrender.com`, que para el navegador son sitios distintos), **el login no funciona**. En plataformas así, usá un dominio propio para los dos.

En esta guía, `TU-DOMINIO` es el del frontend (ej. `taller.com`) y `api.TU-DOMINIO` el de la API.

## Requisitos del servidor

- Node.js 22 o superior y npm.
- PostgreSQL 15 o superior.
- Un proxy con HTTPS delante (Caddy, Nginx o el de la plataforma).
- Git, para clonar el repositorio.

## 1. Base de datos

Creá el usuario y la base con los datos de `backend/.env.production` (`DB_USUARIO`, `DB_CLAVE`, `DB_NOMBRE`). Por ejemplo, con `psql` como administrador:

```sql
CREATE USER servicio_tecnico WITH PASSWORD 'pegá acá DB_CLAVE';
CREATE DATABASE servicio_tecnico OWNER servicio_tecnico;
```

Si usás una base administrada (Render, Railway, Neon, etc.), la plataforma te da su propia dirección: en ese caso usá la `DATABASE_URL` que te entregue en lugar de la del archivo.

## 2. Backend

```bash
git clone https://github.com/sebax69k4/cancelar.git servicio-tecnico
```

```bash
cd servicio-tecnico/backend
```

Copiá `backend/.env.production` del dueño como `backend/.env` y revisá:

- `DATABASE_URL`: cambiá `localhost:5432` si la base está en otra máquina.
- `CORS_ORIGIN`: la dirección del frontend, ej. `https://taller.com`.
- `TRUST_PROXY=1` si hay un proxy delante (lo normal). Con `0`, todos los pedidos parecerían venir del proxy.

Las líneas `DB_USUARIO`, `DB_CLAVE` y `DB_NOMBRE` son solo de referencia para el paso 1; el backend no las usa.

Instalá, creá las tablas y compilá:

```bash
npm ci
```

```bash
npx prisma migrate deploy
```

```bash
npm run build
```

Arrancalo (mejor con un gestor de procesos como `pm2` o un servicio de `systemd`, para que se reinicie solo):

```bash
npm run start:prod
```

Comprobá que responde:

```bash
curl https://api.TU-DOMINIO/api/health
```

Tiene que devolver `{"status":"ok","db":"ok",...}`.

Con `NODE_ENV=production` el backend **no arranca** si la configuración es insegura: cookie sin `Secure`, orígenes sin `https://` o sesiones de más de 7 días. El mensaje dice qué corregir. La documentación interactiva (`/api/docs`) queda apagada.

**Evidencias:** las fotos y PDF se guardan en `backend/uploads/` (`UPLOAD_DIR`). Esa carpeta tiene que ser **persistente** (en plataformas con disco efímero, montá un volumen) y entrar en los respaldos.

## 3. Frontend

```bash
cd ../frontend
```

```bash
npm ci
```

La dirección de la API se fija **al compilar**. Creá `frontend/.env` con:

```env
PUBLIC_API_URL=https://api.TU-DOMINIO/api
```

```bash
npm run build
```

Arrancalo, escuchando solo en la máquina (el proxy lo publica):

```bash
HOST=127.0.0.1 PORT=4321 node dist/server/entry.mjs
```

Si cambia la dirección de la API, hay que volver a compilar.

## 4. Proxy con HTTPS

Ejemplo con **Caddy** (obtiene y renueva los certificados solo). En `/etc/caddy/Caddyfile`:

```text
TU-DOMINIO {
  reverse_proxy 127.0.0.1:4321
  header {
    Strict-Transport-Security "max-age=31536000"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
}

api.TU-DOMINIO {
  reverse_proxy 127.0.0.1:3000
  request_body {
    max_size 11MB
  }
}
```

Con **Nginx** es lo mismo: dos `server` con `proxy_pass` a `127.0.0.1:4321` y `127.0.0.1:3000`, `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` y `client_max_body_size 11m;` en el de la API (las evidencias pesan hasta 10 MB).

## 5. Primer uso

1. Abrí `https://TU-DOMINIO`.
2. **Crear cuenta de taller**: quien la crea queda como Admin.
3. En Configuración, agregá a las personas y **asigná todos los roles** (Supervisor, Recepción y Técnico; una persona puede tener varios). Hasta entonces el sistema no deja cargar órdenes.

No hay usuarios ni contraseñas por defecto.

## 6. Mantenimiento

- **Respaldos** diarios de la base y de `backend/uploads/`:

  ```bash
  pg_dump -U servicio_tecnico -Fc servicio_tecnico > respaldo-$(date +%F).dump
  ```

- **Actualizar** a una versión nueva: `git pull`, y en cada carpeta `npm ci` y `npm run build`; en `backend/` además `npx prisma migrate deploy` antes de reiniciar.
- **Registro de seguridad**: el backend escribe una línea JSON por evento con el contexto `Seguridad` (logins fallidos, accesos denegados, archivos rechazados…). Conviene guardar esos logs.
- **Nunca** correr `npm run db:reset` en producción: borra la base.

## Lista de control

- [ ] Frontend y API bajo el mismo dominio, los dos con HTTPS.
- [ ] Base creada con el usuario y la contraseña de `.env.production`.
- [ ] `backend/.env` con `CORS_ORIGIN` del frontend y `TRUST_PROXY=1`.
- [ ] `npx prisma migrate deploy` sin errores.
- [ ] `/api/health` responde `ok`.
- [ ] `frontend/.env` con `PUBLIC_API_URL` de la API, compilado después.
- [ ] `backend/uploads/` persistente y con respaldo.
- [ ] Cuenta del taller creada y roles asignados.
