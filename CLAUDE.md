# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Descripción

TurnoFlex: aplicación web de gestión de turnos (Node.js 18+, Express 5, MongoDB/Mongoose 8, vistas Pug, CommonJS). Todo el código, mensajes, README y comentarios están en español rioplatense; mantené ese idioma.

## Comandos

```bash
npm install
cp .env.example .env     # variables: PORT, MONGO_URI, JWT_SECRET, JWT_MINUTOS, CHAT_MAX_POR_ADMIN, CHAT_TIMEOUT_MINUTOS
npm run seed             # BORRA la base y crea datos y usuarios de prueba (admin/admin123, admin2/admin123, etc.)
npm run dev              # nodemon src/index.js
npm start                # node src/index.js
```

Con Docker (modo desarrollo, hot-reload con nodemon sobre `./src` montado como volumen; guía en `docs/Docker/docker-readme.md`):

```bash
docker compose up --build -V         # app + mongo; -V renueva node_modules (obligatorio tras agregar dependencias); Compose sobrescribe MONGO_URI a mongodb://mongo:27017/turnoflex
docker compose exec app npm run seed
docker compose down -v               # detiene y borra los datos (volumen mongo_data)
```

Sin Docker requiere una instancia de MongoDB corriendo (por defecto `mongodb://127.0.0.1:27017/turnoflex`). No hay tests ni linter configurados. La colección de Postman está en `docs/TurnoFlex.postman_collection.json`.

## Arquitectura

- **Vistas y API separadas.** `src/routes/vistasRoutes.js` solo renderiza el esqueleto de cada página con Pug; los datos los carga el JS del navegador (`src/public/js/*.js`, usando `api.js` como wrapper de `fetch`) contra `/api/...`, que siempre responde JSON.
- **Frontend con Tailwind 4 por CDN** (`@tailwindcss/browser`, sin build ni CSS propio). La paleta, las variantes custom (`colapsada`, `drawer-abierto`) y los pocos componentes compartidos con el JS del navegador (`.btn*`, `.etiqueta`, `.estado-*`, `.etiqueta-*`, `.fila-*`) viven en `src/views/includes/tema.pug`; los componentes de vista (campos, tablas, modales, íconos SVG, logo) son mixins en `src/views/includes/mixins.pug`. `layouts/base.pug` es el esqueleto HTML + footer (lo usan `login` y `error`); `layout.pug` lo extiende con navbar + sidebar para las páginas logueadas; `src/public/js/layout.js` maneja sidebar y menú de usuario. Usá clases de Tailwind directamente en Pug. Detalle en `docs/refactor-frontend.md`.
- **Autenticación stateless (Passport + JWT):** no hay sesiones en el servidor. Estrategias en `src/config/passport.js`: `local` (login, compara con bcrypt) y `jwt` (token HS256 tomado de `Authorization: Bearer` o de la cookie httpOnly `token`). Firma y cookie en `src/helpers/token.js`. El login devuelve el token en el JSON y lo setea en la cookie (las vistas Pug dependen de la cookie). Detalle completo en `docs/refactor-passport-jwt.md`.
- **Cadena de middlewares por ruta:** `requiereLogin` → `requierePermiso("recurso:accion")` → controlador (`src/middlewares/auth.js`). `requiereLogin` usa la estrategia `jwt`, cuyo `verify` vuelve a leer el usuario desde Mongo: si está desactivado, eliminado o vencido (`expiraEl`) rechaza el token y audita `SESION_REVOCADA`; si `payload.ver !== usuario.tokenVersion` (logout o cambio de contraseña) también lo rechaza. Renueva la cookie cuando el token consumió la mitad de su vida. Distingue API de vistas por el prefijo `/api` (401 JSON vs. redirect a `/login`). `usuarioOpcional` carga el usuario sin cortar la request (lo usa `/login`).
- **Permisos:** la matriz CRUD vive solo en `src/config/roles.js`. Los roles son jerárquicos por spread de arrays (`profesional` ⊂ `recepcion` ⊂ `admin`). Para agregar un permiso, definilo ahí y usalo en la ruta.
- **Control por contexto** (en controladores, no en roles): el rol `profesional` solo ve sus propios turnos y solo puede pasarlos a `atendido`; un admin no puede desactivarse, cambiarse el rol, ponerse vencimiento ni eliminarse a sí mismo.
- **Errores:** Express 5 propaga errores de controladores `async` al `errorHandler` (`src/middlewares/errores.js`), que traduce errores de Mongoose (validación → 400, id inválido → 400, duplicado → 409). No hace falta `try/catch` en los controladores.
- **Auditoría:** `registrarAuditoria(req, accion, {...})` en `src/helpers/auditoria.js`; la acción debe estar en la lista permitida del modelo `Auditoria`. Se llama en login/logout, altas/bajas/modificaciones, cambios de estado y accesos denegados.
- **Mass assignment:** los controladores filtran el body con `tomarCampos()` (`src/helpers/campos.js`); usalo en todo endpoint nuevo de escritura.
- **Contraseñas:** hasheadas con bcrypt en el `pre("save")` de `Usuario` (usá `create`/`save`, no `updateOne`, para cambiarlas); campo `select: false` y excluido en `toJSON` junto con `tokenVersion`; no devolverlas nunca en respuestas.
- **Errores de negocio:** lanzá `crearError(status, mensaje)` (`src/helpers/errores.js`); el `errorHandler` responde ese status con ese mensaje (incluido 503). Un `err.status` 4xx sin `expuesto` sigue respondiendo el mensaje genérico.
- **`sanitizeFilter` está activo** (`src/config/db.js`): todo filtro de Mongoose con operadores `$` escritos por el servidor debe ir envuelto en `mongoose.trusted({ $in: [...] })`, si no se neutraliza en silencio. Los `$or`/`$and` de primer nivel y los pipelines de `aggregate` no se sanitizan. Nunca pases datos del cliente a `trusted`.

## WebSockets: chat de consultas (Socket.io)

Detalle completo en `docs/refactor-websockets.md`.

- **Híbrido REST + Socket.io.** Las acciones van por `/api/chats` (cadena normal de middlewares, `tomarCampos`, auditoría y errores). Socket.io solo **empuja** eventos servidor → cliente. El único evento cliente → servidor es `chat:escribiendo`. No agregues comandos por socket: agregá un endpoint y emití desde el servicio.
- **Archivos:**
  - `src/services/chatService.js`: toda la lógica (máquina de estados, `elegirAdmin`, reasignación, timeouts).
  - `src/services/chatTimeouts.js`: `setTimeout` en memoria.
  - `src/socket/index.js`: `iniciarSocket(servidor)`, handshake y salas.
  - `src/socket/emisor.js`: `emitirA(ids, evento, datos)` y `desconectarUsuario(id)`. Importalo desde servicios y controladores; nunca importes `socket/index.js`, porque genera un ciclo.
  - `src/socket/presencia.js`: admins conectados.
  - `src/config/chat.js`: límites.
  - `src/models/Chat.js`.
- **Auth del socket:** `io.use` llama a `autenticar("jwt", socket.request)` de `middlewares/auth.js`, después de parsear las cookies con `cookie-parser`. Si falla, responde `next(new Error("NO_AUTENTICADO"))` y el cliente redirige a `/login`. Al vencer el `exp` del token, el servidor desconecta el socket y el cliente se reconecta con la cookie renovada.
- **Salas:** solo `usuario:<id>` (no hay salas por chat). La app es multipágina y el socket se reconecta en cada navegación; emitir a la sala del usuario cubre la reconexión y las múltiples pestañas. El cliente vuelve a pedir `GET /api/chats` en cada `connect`.
- **Presencia:** `Map` en memoria adminId → socketIds, con **gracia de 10 s** al quedarse sin sockets. Al vencer la gracia, `reasignarPendientesDe(admin)`. Cuando un admin se conecta, `asignarHuerfanos`. Solo funciona con **un proceso** de Node.
- **Revocación:** el logout y los cambios de usuario que quitan permisos (desactivar, cambiar rol, vencimiento, contraseña de otro, eliminar) llaman a `desconectarUsuario`. Si el usuario era admin, también a `liberarChatsDeAdmin`.
- **Permisos:** `chat:usar` (en `profesional`, heredado por todos) y `chat:moderar` (admin). Que un admin no pueda iniciar un chat es control por contexto en el servicio (403); no le saques el permiso al rol.
- **Frontend:**
  - `includes/chatDrawer.pug`: drawer sin overlay, vista según el rol.
  - `public/js/chat.js`: IIFE, se carga con `defer` después de `/socket.io/socket.io.js`.
  - Variante `chat-abierto` (`data-chat="abierto"` en `<html>`, persistido en `sessionStorage` y restaurado en `layouts/base.pug`).
  - Clases `.burbuja*` y `.estado-chat-*` en `tema.pug`.
  - Textos de usuario siempre con `textContent`.

### Reglas de negocio del chat

- Solo `recepcion` y `profesional` inician (admin → 403); no hay chats entre admins. Un chat abierto por usuario (409; índice único parcial `un_chat_abierto_por_usuario`).
- Estados: `pendiente` → `activo` | `rechazado` | `finalizado` (timeout); `activo` → `finalizado` (admin). `finalizado` y `rechazado` son finales; `motivoCierre` ∈ `admin`, `timeout`, `rechazo`.
- Cada transición es un `findOneAndUpdate` con el estado de origen en el filtro (si pierde la carrera → 409 vía `errorDeTransicion`). La elección de admin y la creación/reasignación corren dentro del mutex `encolar()`.
- Asignación a **un** admin conectado con carga (pendientes + activos, contada en Mongo) menor a `CHAT_MAX_POR_ADMIN` (por defecto 3): el de menor carga, con desempate al azar. Si no hay → 503 "Todos los operadores se encuentran ocupados en este momento" y auditoría `CHAT_SIN_OPERADOR`.
- Solo se envían mensajes en `activo` (1 a 1000 caracteres). Solo el admin asignado acepta, rechaza o finaliza.
- Timeout de `CHAT_TIMEOUT_MINUTOS` (por defecto 5) en `pendiente`, controlado por el servidor. `recuperarTimeouts()` lo reprograma al arrancar.
- Las acciones del servidor (timeout, reasignación) se auditan con `usuarioNombre: "sistema"`.

## Reglas de negocio de turnos

- Sin doble reserva (mismo profesional o mismo cliente en misma fecha y hora) → 409.
- Estados: `reservado` → `atendido` | `cancelado`; ambos son finales.
- Solo se eliminan turnos `cancelado`.
- No se puede eliminar un cliente o profesional con turnos reservados (409), ni un profesional con usuario vinculado.
- Formatos: fecha `YYYY-MM-DD`, hora `HH:mm`, DNI de 7 u 8 dígitos.
