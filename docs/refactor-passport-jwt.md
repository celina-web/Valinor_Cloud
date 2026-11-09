# Refactor: de `express-session` a Passport + JWT (stateless)

Este documento explica el cambio del mecanismo de autenticación de TurnoFlex: qué había, qué hay ahora, por qué se tomó cada decisión, qué archivos cambiaron y cómo se verificó que la aplicación siga funcionando igual.

---

## 1. Motivación

La versión anterior usaba **sesiones con estado** (`express-session`):

- El servidor guardaba cada sesión en memoria (el `MemoryStore` por defecto) y el navegador solo tenía la cookie `connect.sid` con el id.
- Al reiniciar el servidor (algo que pasa todo el tiempo con `nodemon` o con Docker) se perdían todas las sesiones.
- No escalaba a más de una instancia sin agregar un store compartido (Redis, Mongo).
- Las contraseñas se guardaban y comparaban **en texto plano**.

El objetivo fue pasar a una autenticación **stateless** con **Passport** y **JSON Web Tokens**: el servidor no guarda sesiones, cada request lleva un token firmado que se valida por sí mismo. De paso, se hashean las contraseñas con bcrypt.

## 2. Resumen antes / después

| Aspecto | Antes (`express-session`) | Ahora (Passport + JWT) |
|---|---|---|
| Estado en el servidor | Sesión en memoria por usuario | Ninguno: el token se valida con la firma |
| Credencial del cliente | Cookie `connect.sid` (id de sesión) | JWT en cookie `token` (httpOnly) **o** header `Authorization: Bearer` |
| Login | Controlador propio + `req.session.regenerate` | Estrategia `passport-local` + firma del JWT |
| Requests autenticadas | `req.session.usuarioId` + lectura del usuario | Estrategia `passport-jwt` + lectura del usuario |
| Contraseñas | Texto plano | Hash bcrypt (`bcryptjs`, 10 rondas) |
| Expiración | `SESSION_MINUTOS` de inactividad (`rolling`) | `JWT_MINUTOS` con renovación deslizante (mismo efecto en el navegador) |
| Logout | `req.session.destroy()` | Se incrementa `tokenVersion` y se borra la cookie |
| Revocación de usuario desactivado / vencido / eliminado | Al instante (se leía el usuario en cada request) | Al instante (se sigue leyendo el usuario en cada request) |
| Reinicio del servidor | Cerraba la sesión de todos | No afecta: los tokens siguen siendo válidos |
| Variables de entorno | `SESSION_SECRET`, `SESSION_MINUTOS` | `JWT_SECRET`, `JWT_MINUTOS` |

Lo que **no** cambió: la matriz de permisos (`src/config/roles.js`), `requierePermiso`, el control por contexto en los controladores, las reglas de negocio, las vistas Pug, la forma de las respuestas de la API (salvo que el login ahora también devuelve el `token`) y las acciones de auditoría.

## 3. Decisiones de diseño

### 3.1 ¿Por dónde viaja el token? Cookie httpOnly **y** Bearer

La app tiene dos tipos de cliente:

1. **El navegador**, que navega páginas Pug renderizadas en el servidor. Al hacer clic en un link (`GET /clientes`), el navegador **no** puede agregar un header `Authorization`, y el layout necesita saber quién es el usuario para armar el menú según sus permisos.
2. **Clientes de API** (Postman, otro front, un script), que trabajan cómodamente con `Authorization: Bearer <token>`.

Por eso el login hace las dos cosas: **setea el JWT en una cookie** y **lo devuelve en el JSON**. `passport-jwt` busca el token primero en el header Bearer y, si no está, en la cookie.

Se descartó guardar el token en `localStorage`: obligaba a convertir las vistas en esqueletos públicos y armar el menú en el cliente, y además deja el token al alcance de cualquier script inyectado (XSS). La cookie `httpOnly` no la puede leer JavaScript.

Configuración de la cookie (`src/helpers/token.js`):

| Opción | Valor | Motivo |
|---|---|---|
| nombre | `token` | |
| `httpOnly` | `true` | El JS del navegador no puede leerla (mitiga XSS) |
| `sameSite` | `strict` | El navegador no la manda en requests iniciadas desde otro sitio (mitiga CSRF) |
| `secure` | `true` solo si `NODE_ENV=production` | En desarrollo se usa `http://localhost` |
| `maxAge` | `JWT_MINUTOS` | La cookie vence junto con el token |

### 3.2 Contenido del token

```json
{ "sub": "<_id del usuario>", "usuario": "admin", "ver": 0, "iat": 1700000000, "exp": 1700001800 }
```

- `sub`: id del usuario (estándar JWT).
- `usuario`: nombre de usuario, para poder auditar `SESION_REVOCADA` aun si el usuario ya fue eliminado.
- `ver`: valor de `tokenVersion` al momento de firmar (ver 3.4).
- **No** se incluye el rol ni los permisos: se leen de la base en cada request, así un cambio de rol aplica al instante.
- Firma **HS256** con `JWT_SECRET`. La estrategia acepta **solo** ese algoritmo (`algorithms: ["HS256"]`), lo que bloquea tokens con `alg: none` u otros algoritmos.

### 3.3 ¿Stateless con lectura de usuario?

Un JWT "puro" no consulta la base: si se desactiva a un usuario, su token sigue sirviendo hasta que vence. Eso rompía una funcionalidad existente (revocación inmediata y auditoría `SESION_REVOCADA`). Por eso la estrategia JWT **valida la firma y la expiración sin estado**, y después **vuelve a leer el usuario** desde Mongo, igual que hacía antes `requiereLogin`. No se guarda ninguna sesión; es una lectura por request, la misma que ya existía.

### 3.4 `tokenVersion`: logout e invalidación por cambio de contraseña

Sin sesiones, "cerrar sesión" no puede borrar nada del servidor. Para que el logout invalide de verdad el token se agregó el campo `tokenVersion` al modelo `Usuario`:

- Cada token lleva `ver = tokenVersion` del momento en que se firmó.
- Si `payload.ver !== usuario.tokenVersion`, el token se rechaza (401 "Tu sesión fue cerrada. Ingresá de nuevo").
- **Logout:** `tokenVersion += 1`. Efecto: se cierran las sesiones de ese usuario **en todos los dispositivos**.
- **Cambio de contraseña:** el hook `pre("save")` incrementa `tokenVersion`, así que cualquier token emitido con la contraseña anterior deja de valer. Si el admin cambia **su propia** contraseña, el controlador le emite un token nuevo para no echarlo.
- `tokenVersion` no se devuelve nunca en las respuestas (se quita en `toJSON`).

### 3.5 Renovación deslizante

Con `express-session` y `rolling: true` la sesión expiraba por **inactividad**. Para mantener ese comportamiento en el navegador, `requiereLogin` revisa cuánto le queda al token: si vino por cookie y ya consumió más de la mitad de su vida, firma uno nuevo y reenvía la cookie. Mientras el usuario usa la app, no lo echa; si deja de usarla `JWT_MINUTOS`, el token vence.

Los tokens enviados por Bearer **no** se renuevan solos: un cliente de API vuelve a hacer login cuando recibe 401.

### 3.6 Contraseñas con bcrypt

- Se usa `bcryptjs` (JavaScript puro): no necesita compilar módulos nativos, así funciona igual en la imagen `node:22-alpine` y en cualquier sistema operativo.
- El hash se aplica en un hook `pre("save")` del modelo, solo si el campo `password` cambió. Como `Usuario.create()` y `usuario.save()` disparan ese hook, `crearUsuario`, `actualizarUsuario` y el seed hashean sin cambios adicionales.
- Mongoose ejecuta la validación **antes** de ese hook, así que la regla de mínimo 6 caracteres se sigue aplicando a la contraseña en claro.
- La comparación se hace con `usuario.compararPassword()` (`bcrypt.compare`), que es resistente a ataques de tiempo.

## 4. Flujos

### 4.1 Login

```
Navegador / Postman                     Servidor
      | POST /api/auth/login {usuario, password}
      |------------------------------------->|  authController.login
      |                                      |   1. faltan datos -> 400
      |                                      |   2. passport "local":
      |                                      |      busca usuario (+password), bcrypt.compare
      |                                      |      no existe / no coincide -> 401 + LOGIN_FALLIDO
      |                                      |      desactivado o vencido   -> 403 + LOGIN_FALLIDO
      |                                      |   3. firmarToken(usuario)  {sub, usuario, ver}
      |                                      |   4. Set-Cookie: token=...; HttpOnly; SameSite=Strict
      |                                      |   5. ultimoAcceso = ahora (sin tocar updatedAt)
      |                                      |   6. auditoría LOGIN
      |<-------------------------------------|  200 { token, usuario, nombre, rol }
```

### 4.2 Request autenticada

```
GET /api/turnos  (cookie "token" o Authorization: Bearer)
  -> requiereLogin
       passport "jwt": extrae token (Bearer o cookie), verifica firma HS256 y exp
         sin token / firma inválida / vencido      -> 401 (API) o redirect /login (vistas), se borra la cookie
       verify: Usuario.findById(sub)
         eliminado, desactivado o vencido          -> 401 + auditoría SESION_REVOCADA
         ver !== tokenVersion (logout / password)  -> 401
       ok: req.usuario, res.locals.{usuario, permisos, puede}
           si vino por cookie y le queda < 50% -> se reenvía cookie con token nuevo
  -> requierePermiso("turnos:read")   (sin cambios)
  -> controlador                      (sin cambios; usa req.usuario)
```

### 4.3 Logout

```
POST /api/auth/logout -> requiereLogin -> tokenVersion += 1, auditoría LOGOUT, se borra la cookie, 204
```

## 5. Cambios archivo por archivo

### Dependencias (`package.json`)

- **Se quitó:** `express-session`.
- **Se agregaron:** `passport`, `passport-local`, `passport-jwt`, `jsonwebtoken`, `bcryptjs`, `cookie-parser`.

### Variables de entorno (`.env.example`)

| Antes | Ahora | Notas |
|---|---|---|
| `SESSION_SECRET` | `JWT_SECRET` | Clave para firmar los tokens. Si falta, se usa una clave de desarrollo y se muestra un aviso al iniciar. |
| `SESSION_MINUTOS` | `JWT_MINUTOS` | Vida del token en minutos (por defecto 30). |

### `src/helpers/token.js` (nuevo)

Concentra todo lo relativo al token: lee `JWT_SECRET` / `JWT_MINUTOS`, `firmarToken(usuario)`, `enviarTokenEnCookie(res, token)`, `borrarCookieToken(res)` y `tokenDeCookie(req)` (el extractor que usa passport-jwt).

### `src/config/passport.js` (nuevo)

Registra las dos estrategias:

- **`local`**: campos `usuario` y `password`. Normaliza el usuario (trim + minúsculas), lo busca con `+password` y compara con bcrypt. No responde por su cuenta: devuelve los fallos como `info` (`status`, `error`, `detalle`) para que el controlador responda y audite.
- **`jwt`**: extrae el token de `Authorization: Bearer` o de la cookie `token`, acepta solo HS256 y, en el `verify`, lee el usuario y aplica las reglas de revocación (3.3 y 3.4).

### `src/models/Usuario.js`

- Campo nuevo `tokenVersion` (número, por defecto 0), excluido del `toJSON`.
- Hook `pre("save")`: hashea la contraseña si cambió e incrementa `tokenVersion` si no es un usuario nuevo.
- Método `compararPassword(password)`.
- `estaHabilitado()` sin cambios.

### `src/middlewares/auth.js`

- `autenticar(estrategia, req, res)`: envuelve `passport.authenticate(..., { session: false }, callback)` en una Promise. Así los middlewares siguen siendo `async` y Express 5 lleva cualquier error al `errorHandler`, como antes.
- `requiereLogin`: misma responsabilidad y mismas respuestas que antes (401 JSON en `/api`, redirect a `/login` en vistas, `SESION_REVOCADA` auditada), ahora sobre la estrategia `jwt`. Agrega la renovación deslizante y borra la cookie cuando el token ya no sirve.
- `usuarioOpcional` (nuevo): carga el usuario si hay un token válido, sin cortar la request. Lo usa `/login` para redirigir a `/` si ya estás logueado.
- `requierePermiso`: sin cambios.
- Se eliminó `destruirSesion`.

### `src/controllers/authController.js`

- `login`: mantiene el 400 por datos faltantes; delega la verificación en la estrategia `local`; firma el token, lo manda en la cookie y lo devuelve en el JSON (`{ token, usuario, nombre, rol }`). Se mantienen `ultimoAcceso` (sin modificar `updatedAt`) y las auditorías `LOGIN` / `LOGIN_FALLIDO`. Se eliminó `regenerarSesion`.
- `logout`: incrementa `tokenVersion`, audita `LOGOUT`, borra la cookie `token` (antes borraba `connect.sid`) y responde 204.
- `usuarioActual`: sin cambios.

### `src/controllers/usuariosController.js`

Si un admin cambia **su propia** contraseña, se le reemite el token en la cookie (el cambio de contraseña invalidó el anterior).

### `src/index.js`

Se quitó la configuración de `express-session` y se agregaron `cookieParser()`, la carga de `./config/passport` y `passport.initialize()`. No se usa `passport.session()`.

### `src/routes/vistasRoutes.js` y `src/controllers/vistasController.js`

`GET /login` pasa por `usuarioOpcional`, y `mostrarLogin` usa `req.usuario` en lugar de `req.session.usuarioId`.

### Front (`src/public/js/api.js`)

Sin cambios funcionales. `fetch` en el mismo origen envía la cookie automáticamente, el 401 sigue redirigiendo a `/login` y el botón "Salir" sigue llamando a `/api/auth/logout`. Solo se agregó un comentario aclarando que el token no se lee ni se guarda desde JavaScript. Las vistas Pug no cambiaron.

### Colección de Postman (`docs/TurnoFlex.postman_collection.json`)

- La colección usa **Bearer** `{{token}}` como autenticación por defecto.
- Los logins guardan el token en variables: `token` (admin), `tokenRecepcion` y `tokenProfesional`. La carpeta **Permisos** usa `{{tokenProfesional}}`.
- Casos nuevos en **Auth**: sin token (401), token inválido (401), token usado después del logout (401) y un segundo login de admin para seguir con las demás carpetas.
- Antes la colección se corría a mano request por request (el logout cortaba la sesión y el resto daba 401). Ahora se puede correr **completa y en orden** con el Runner o con `newman`.

### Documentación

`README.md`, `docs/Docker/docker-readme.md` y `CLAUDE.md` se actualizaron para reflejar el nuevo esquema y las nuevas variables de entorno.

## 6. Migración de datos

Las contraseñas existentes en la base están en texto plano y **no** coinciden con `bcrypt.compare`. Después de actualizar hay que volver a cargar los datos de prueba:

```bash
npm run seed                          # sin Docker
docker compose exec app npm run seed  # con Docker
```

Si hubiera usuarios reales que conservar, alcanza con que un admin les vuelva a asignar la contraseña desde la pantalla de Usuarios (el `save` la hashea).

Con Docker, además, hay que reconstruir la imagen para instalar las dependencias nuevas, renovando el volumen anónimo de `node_modules`:

```bash
docker compose up --build -V
```

## 7. Seguridad: qué cubre y qué no

**Cubre**

- Contraseñas hasheadas con bcrypt; nunca viajan en las respuestas (ni `password` ni `tokenVersion`).
- Token firmado (HS256), con algoritmo fijo y expiración.
- Cookie `httpOnly` (no la lee JavaScript) y `sameSite=strict` (el navegador no la envía desde otros sitios, lo que mitiga CSRF).
- Revocación inmediata por usuario desactivado, vencido o eliminado; invalidación por logout y por cambio de contraseña.
- El payload no tiene datos sensibles ni permisos: el rol se lee siempre de la base.

**No cubre / a tener en cuenta**

- El logout cierra la sesión del usuario en **todos** sus dispositivos (es la forma de invalidar sin guardar estado).
- Un token robado sirve hasta que vence o hasta que el usuario hace logout o cambia la contraseña. Por eso la vida del token es corta.
- En producción hay que definir un `JWT_SECRET` largo y aleatorio, servir la app por HTTPS y usar `NODE_ENV=production` para que la cookie sea `secure`.
- No hay límite de intentos de login (rate limiting); quedó fuera del alcance de este refactor.

## 8. Verificación

No hay tests automatizados en el proyecto, así que la verificación se hizo con scripts de `curl` y con la colección de Postman ejecutada con `newman`, sobre una base de prueba separada (`turnoflex_refactor`) recién cargada con `npm run seed`.

1. **Línea base (antes del refactor):** un script de regresión de 83 casos que cubre login, vistas, permisos, control por contexto, ABM, reglas de negocio de turnos, usuarios, revocación, auditoría y logout. Usa cookies, así que sirve para los dos enfoques. Resultado con `express-session`: **83/83**.
2. **Mismo script después del refactor:** **83/83**. El comportamiento visible no cambió.
3. **Casos propios de JWT** (41 casos, todos OK):
   - el login devuelve un JWT y setea la cookie `HttpOnly; SameSite=Strict`; el payload solo tiene `sub`, `usuario`, `ver`, `iat` y `exp`;
   - acceso con Bearer, con cookie y a vistas con cookie;
   - 401 sin token, con token alterado, con firma de otra clave, con `alg: none` y con token vencido; en las vistas, redirect a `/login` y borrado de la cookie;
   - renovación: una cookie con poca vida se renueva, una recién emitida no, y un token Bearer no recibe cookie;
   - las 4 contraseñas del seed quedan guardadas como hash `$2b$10$…`;
   - logout invalida el token usado y los de otros dispositivos; un login nuevo funciona;
   - cambiar el nombre de un usuario no invalida su token y cambiar la contraseña sí; el admin que cambia su propia contraseña recibe una cookie nueva y sigue logueado;
   - `tokenVersion` no aparece en el listado de usuarios;
   - un usuario eliminado con token vigente recibe 401 y se audita `SESION_REVOCADA` con su nombre de usuario.
4. **Postman / newman:** la colección actualizada corre completa: **46 requests, 51 aserciones, 0 fallas**.
5. **Docker:** la imagen se reconstruye, el contenedor encuentra todas las dependencias nuevas y la app inicia y se conecta a Mongo.
6. `grep -rn "session" src` solo encuentra la opción `{ session: false }` de Passport; no quedan referencias a `express-session` ni a `connect.sid`. La acción de auditoría `SESION_REVOCADA` conserva su nombre para no romper los registros existentes ni el filtro de la pantalla de auditoría.
