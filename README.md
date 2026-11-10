# TurnoFlex: Sistema de Gestión de Turnos

TurnoFlex es una aplicación web, hecha con **Node.js**, **Express** y **MongoDB** (con Mongoose), para gestionar los
turnos de un centro de atención. Permite administrar profesionales, clientes y turnos, aplicando reglas de negocio. Es un **producto mínimo viable** con:

- Persistencia en **MongoDB** usando Mongoose.
- **Autenticación stateless con Passport + JWT**: login con `passport-local` (contraseñas hasheadas con bcrypt) y protección de rutas con `passport-jwt`. El token viaja en una cookie `httpOnly` o en el header `Authorization: Bearer`.
- **Roles jerárquicos y permisos CRUD**: `admin` > `recepcion` > `profesional`.
- **Auditoría** de todas las acciones relevantes.
- **Front con `fetch`**: las pantallas cargan y guardan datos de forma asincrónica, sin recargar la página.
- **Interfaz con Tailwind CSS 4** (por CDN, sin paso de build): navbar y sidebar colapsable, menú de usuario, colores por estado de turno y diseño responsive para móviles, tablets, portátiles y escritorio.
- **Chat de consultas en tiempo real con WebSockets (Socket.io)**: recepción y profesionales le consultan a un administrador desde un panel lateral. Cada consulta pasa por los estados pendiente, activo, finalizado o rechazado, y vence a los 5 minutos si nadie la acepta.

---

## Requisitos

- Node.js 18 o superior.
- MongoDB 6 o superior, local (MongoDB Community Server) o en la nube (MongoDB Atlas).

## Instalación y uso

```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
npm run seed              # crea datos y usuarios de prueba (borra lo que haya)
npm run dev               # inicia con nodemon (o npm start)
```

La aplicación queda disponible en **http://localhost:3000**.

> Si venís de una versión anterior (con `express-session`), volvé a correr `npm run seed`: las contraseñas ahora se guardan hasheadas y las que estaban en texto plano ya no sirven para iniciar sesión.
>
> Si venís de una versión sin chat, corré `npm install` (agrega `socket.io`) y `npm run seed` (crea el segundo admin, `admin2`). Con Docker: `docker compose up --build -V`.

### Uso con Docker

También se puede levantar la app y MongoDB con contenedores (modo desarrollo con hot-reload):

```bash
cp .env.example .env
docker compose up --build -V      # -V: renueva node_modules si cambiaron las dependencias
docker compose exec app npm run seed
```

La guía completa está en [`docs/Docker/docker-readme.md`](docs/Docker/docker-readme.md).

### Variables de entorno (`.env`)

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `MONGO_URI` | Cadena de conexión a MongoDB | `mongodb://127.0.0.1:27017/turnoflex` |
| `JWT_SECRET` | Clave para firmar los JWT (HS256). En producción, un texto largo y aleatorio | clave de desarrollo (con aviso al iniciar) |
| `JWT_MINUTOS` | Vida del token en minutos. En el navegador se renueva mientras se usa la app | `30` |
| `CHAT_MAX_POR_ADMIN` | Máximo de chats abiertos (pendientes + activos) que puede tener cada admin | `3` |
| `CHAT_TIMEOUT_MINUTOS` | Minutos que espera una consulta a ser aceptada antes de vencer. Acepta decimales (`0.5` = 30 s) para probar | `5` |

### Usuarios de prueba (creados por `npm run seed`)

| Usuario | Contraseña | Rol | Contexto |
|---|---|---|---|
| `admin` | `admin123` | admin | Todo el sistema |
| `admin2` | `admin123` | admin | Segundo operador, para probar el reparto de chats |
| `recepcion` | `recepcion123` | recepcion | Clientes, profesionales y turnos |
| `profesional1` | `prof1234` | profesional | Solo los turnos de la instructora Ferreyra |
| `profesional2` | `prof5678` | profesional | Solo los turnos del instructor Acosta |

---

## Estructura del proyecto

```
Valinor_Cloud/
├── .env.example
├── docs/
│   ├── TurnoFlex.postman_collection.json
│   ├── refactor-passport-jwt.md         Detalle del paso de express-session a Passport + JWT
│   ├── refactor-frontend.md             Detalle del rediseño del frontend con Tailwind 4
│   ├── refactor-websockets.md           Detalle del chat en tiempo real con Socket.io
│   └── Docker/docker-readme.md          Guía para levantar el proyecto con Docker
└── src/
    ├── index.js                         Configura Express, cookies, Passport, rutas, errores y Socket.io; conecta a Mongo
    ├── seed.js                          Carga datos y usuarios de prueba
    ├── config/
    │   ├── db.js                        Conexión a MongoDB con Mongoose
    │   ├── passport.js                  Estrategias local (login) y jwt (requests autenticadas)
    │   ├── roles.js                     Roles, jerarquía y permisos CRUD
    │   └── chat.js                      Límite de chats por admin, timeout y gracia de desconexión
    ├── models/                          Esquemas de Mongoose
    │   ├── Cliente.js  
    │   ├── Profesional.js  
    │   ├── Turno.js
    │   ├── Usuario.js                   Usuario, rol, estado, vencimiento, fechas y hash de contraseña
    │   ├── Chat.js                      Consulta, estado, admin asignado, vencimiento y mensajes
    │   └── Auditoria.js                 Registro de eventos
    ├── controllers/                     Lógica de cada recurso (async/await)
    ├── services/
    │   ├── chatService.js               Máquina de estados del chat, asignación de admins y reasignación
    │   └── chatTimeouts.js              Temporizadores del vencimiento de consultas pendientes
    ├── socket/
    │   ├── index.js                     Servidor Socket.io: autenticación JWT en el handshake y salas por usuario
    │   ├── emisor.js                    emitirA() y desconectarUsuario()
    │   └── presencia.js                 Admins conectados (en memoria) con período de gracia
    ├── routes/
    │   ├── api/                         API REST en JSON (/api/...)
    │   └── vistasRoutes.js              Páginas Pug
    ├── middlewares/
    │   ├── auth.js                      requiereLogin, usuarioOpcional y requierePermiso
    │   ├── errores.js                   404 y manejo centralizado de errores
    │   └── logger.js                    Log de cada request
    ├── helpers/
    │   ├── auditoria.js                 registrarAuditoria()
    │   ├── campos.js                    tomarCampos(): solo acepta campos permitidos
    │   ├── errores.js                   crearError(): errores de negocio con status y mensaje
    │   └── token.js                     Firma del JWT y manejo de la cookie
    ├── views/                           Plantillas Pug
    │   ├── layouts/base.pug             Esqueleto HTML: Tailwind, tema, footer y scripts comunes
    │   ├── layout.pug                   Shell de la app logueada: navbar + sidebar + contenido
    │   ├── includes/
    │   │   ├── tema.pug                 Configuración de Tailwind: paleta, variantes y componentes
    │   │   ├── mixins.pug               Componentes de vista: campos, tablas, modales, íconos, logo
    │   │   ├── chatDrawer.pug           Panel lateral del chat (vista según el rol)
    │   │   └── navbar.pug  sidebar.pug  footer.pug
    │   ├── login.pug  error.pug         Páginas sin shell (extienden layouts/base)
    │   └── home.pug  clientes/  profesionales/  turnos/  usuarios/  auditoria/
    └── public/
        └── js/                          JS del navegador (fetch a la API, layout.js para sidebar y menú, chat.js para el chat)
```

### Cómo funciona

1. **Vistas y API separadas.** Las rutas de `vistasRoutes.js` solo renderizan la estructura de cada página con Pug. Los datos los pide el navegador con `fetch` a `/api/...`, que siempre responde JSON.
2. **Sin recargas.** Al guardar, editar o eliminar, el JS envía la petición, espera la respuesta con `await` y vuelve a dibujar la tabla. Si hay un error de validación, se muestra al lado del formulario.
3. **Autenticación sin estado.** El login (`POST /api/auth/login`) verifica la contraseña con la estrategia `local` de Passport, firma un JWT, lo guarda en la cookie `token` (`httpOnly`, `sameSite=strict`) y también lo devuelve en el JSON. El servidor no guarda sesiones: en cada request la estrategia `jwt` toma el token del header `Authorization: Bearer` o de la cookie y verifica su firma y vencimiento. Así funcionan tanto las páginas Pug (el navegador manda la cookie solo) como clientes externos como Postman (header Bearer).
4. **Estilos con Tailwind.** Tailwind 4 se carga por CDN y compila las clases en el navegador, incluidas las de los elementos que crea el JS. La paleta (fondo neutro `#F8F9FA`, lavanda para navbar y sidebar, y los colores de estado de los turnos) se define una sola vez en `src/views/includes/tema.pug`; no hay hojas de estilo propias. En los turnos, `reservado` se muestra en azul cobalto, `atendido` en gris claro y `cancelado` en coral. El detalle está en [`docs/refactor-frontend.md`](docs/refactor-frontend.md).
5. **Middlewares en cadena.** Cada ruta pasa por `requiereLogin` y luego por `requierePermiso("recurso:accion")` antes de llegar al controlador.
6. **Errores centralizados.** Express 5 envía al `errorHandler` los errores de los controladores `async`. Ese middleware traduce los errores de Mongoose a respuestas claras:

   | Error | Respuesta |
   |---|---|
   | Validación | 400 |
   | Id inválido | 400 |
   | Dato duplicado | 409 |
   | Error de negocio (`crearError`) | Su propio status y mensaje (por ejemplo 409 o 503) |
7. **Tiempo real con Socket.io.** Express y Socket.io comparten el mismo servidor HTTP. Las acciones del chat se hacen por la API REST y Socket.io solo empuja los eventos al navegador (consulta nueva, aceptada, mensaje, finalizada). Ver [Chat de consultas](#chat-de-consultas-en-tiempo-real).

---

## Modelos (MongoDB)

Todos los modelos usan `timestamps`, así que guardan `createdAt` (fecha de creación) y `updatedAt` (fecha de modificación).

| Colección | Campos principales | Validaciones |
|---|---|---|
| `clientes` | nombre, apellido, dni, telefono, email | dni único de 7 u 8 números, email válido |
| `profesionales` | nombre, apellido, especialidad, matricula | matrícula única |
| `turnos` | cliente (ref), profesional (ref), fecha, hora, estado, creadoPor (ref) | fecha `YYYY-MM-DD`, hora `HH:mm`, estado en `reservado / atendido / cancelado` |
| `usuarios` | usuario, password (hash bcrypt), nombre, rol, profesional (ref), activo, expiraEl, ultimoAcceso, tokenVersion | usuario único, contraseña de 6 caracteres o más, rol válido, profesional obligatorio si el rol es profesional |
| `chats` | solicitante (ref), rolSolicitante, admin (ref), estado, motivoCierre, expiraEl, aceptadoEl, cerradoEl, mensajes [autor, texto, createdAt] | estado en `pendiente / activo / finalizado / rechazado`, mensajes de 1 a 1000 caracteres, un solo chat abierto por usuario (índice único parcial) |
| `auditoria` | usuario (ref), usuarioNombre, accion, entidad, entidadId, detalle, ip, createdAt | acción dentro de la lista permitida |

### Reglas de negocio de turnos

- Un profesional no puede tener dos turnos reservados en la misma fecha y hora (409).
- Un cliente no puede tener dos turnos reservados en la misma fecha y hora (409).
- El estado solo puede cambiar de `reservado` a `atendido` o `cancelado`. Ambos son estados finales.
- Solo se pueden eliminar turnos `cancelado`.
- No se puede eliminar un cliente o profesional que tenga turnos reservados (409), ni un profesional con un usuario vinculado.

---

## Usuarios, roles y permisos

Los permisos usan la nomenclatura **CRUD**: `recurso:create`, `recurso:read`, `recurso:update` y `recurso:delete`.

| Recurso | profesional | recepcion | admin |
|---|:-:|:-:|:-:|
| clientes | R | C R U D | C R U D |
| profesionales | R | C R U D | C R U D |
| turnos | R\* U\* | C R U D | C R U D |
| usuarios | – | – | C R U D |
| auditoria | – | – | R |
| chat:usar | ✓ | ✓ | ✓ |
| chat:moderar | – | – | ✓ |

\* Con control por contexto: el profesional solo ve **sus** turnos y solo puede marcarlos como **atendidos**.

Los permisos del chat no siguen la nomenclatura CRUD: `chat:usar` permite consultar y escribir, y `chat:moderar` permite aceptar, rechazar y finalizar. Aunque el admin hereda `chat:usar`, **no puede iniciar** una consulta (control por contexto: 403).

La matriz está definida en un único lugar, [`src/config/roles.js`](src/config/roles.js). Cada ruta declara el permiso exacto que necesita, por ejemplo:

```js
router.delete("/:id", requierePermiso("clientes:delete"), eliminarCliente);
```

### Buenas prácticas aplicadas

| Práctica | Cómo se implementa |
|---|---|
| **Mínimo privilegio** | Un usuario nuevo nace con el rol más bajo (`profesional`). Cada endpoint pide un permiso CRUD puntual y no un rol genérico. Los controladores solo aceptan los campos permitidos (`tomarCampos`), así nadie puede cambiar, por ejemplo, el `estado` de un turno al crearlo. La contraseña nunca viaja en las respuestas (`select: false` y `toJSON`). El token no lleva el rol ni los permisos: se leen de la base en cada request. |
| **Contraseñas hasheadas** | Se guardan con bcrypt (`bcryptjs`, 10 rondas) en un hook `pre("save")` del modelo y se comparan con `bcrypt.compare`. |
| **Roles jerárquicos** | En `roles.js`, cada rol hereda los permisos del anterior (`recepcion = [...profesional, ...]` y `admin = [...recepcion, ...]`). |
| **Control por contexto** | Un usuario con rol profesional solo lista y consulta los turnos que tiene asignados, y solo puede pasarlos a `atendido`. Un admin no puede desactivarse, cambiarse el rol, ponerse vencimiento ni eliminarse a sí mismo. |
| **Auditoría** | Se registran LOGIN, LOGIN_FALLIDO, LOGOUT, CREAR, MODIFICAR, ELIMINAR, CAMBIO_ESTADO, ACCESO_DENEGADO, SESION_REVOCADA y CHAT_SIN_OPERADOR, con usuario, entidad, detalle, IP y fecha. Los cambios de estado del chat que hace el servidor (timeout, reasignación) quedan a nombre de `sistema`. El admin los consulta en `/auditoria`. |
| **Revocación automática** | (1) El token vence a los `JWT_MINUTOS`; en el navegador se renueva solo mientras el usuario usa la app, así que en la práctica vence por inactividad. (2) En cada request se vuelve a leer el usuario desde Mongo: si fue desactivado, eliminado o pasó su fecha `expiraEl`, el token se rechaza en ese momento y se audita como SESION_REVOCADA. (3) Cada usuario tiene un `tokenVersion` que se incrementa al hacer logout o al cambiar la contraseña: los tokens anteriores dejan de valer (el logout cierra la sesión en todos los dispositivos). (4) Un usuario vencido o inactivo no puede volver a iniciar sesión. (5) Los sockets del chat se autentican con el mismo JWT y se cierran al hacer logout o cuando un admin desactiva, cambia de rol, vence o elimina al usuario. |
| **Token seguro** | JWT firmado con HS256 (solo se acepta ese algoritmo). La cookie es `httpOnly` (no la lee JavaScript) y `sameSite=strict` (mitiga CSRF); en producción también es `secure`. |
| **Fechas de creación, acceso y modificación** | `createdAt` y `updatedAt` vienen de `timestamps`. `ultimoAcceso` se actualiza en cada login sin modificar `updatedAt`, para no mezclar "accedió" con "lo modificaron". |

---

## Chat de consultas en tiempo real

Los usuarios con rol `recepcion` o `profesional` pueden hacerle una consulta a un administrador desde el **ícono de mensajes de la navbar**, al lado del avatar. El ícono abre un **panel lateral** que se desliza desde la derecha y no bloquea la página. El badge del ícono muestra cuántos chats hay abiertos.

**Reglas**

- Solo `recepcion` y `profesional` pueden **iniciar** una consulta. El `admin` atiende: acepta, rechaza o finaliza. No hay chats entre administradores.
- Cada usuario puede tener **una sola consulta abierta** a la vez (409).
- La consulta se asigna a **un solo admin conectado**: el que tiene menos chats abiertos (empate al azar), siempre que esté debajo de `CHAT_MAX_POR_ADMIN`. Si no hay ninguno conectado o todos llegaron al límite, se responde **503** con "Todos los operadores se encuentran ocupados en este momento".
- Mientras está **pendiente**, el usuario no puede enviar más mensajes. Si ningún admin la acepta en `CHAT_TIMEOUT_MINUTOS` (5), **el servidor** la cierra (`finalizado` por timeout) y le avisa al usuario.
- Cuando el admin la **finaliza** o la **rechaza**, el chat queda cerrado y en solo lectura, y para volver a consultar hay que iniciar una consulta nueva.

**Estados**

```
pendiente ──aceptar──► activo ──finalizar──► finalizado
    │                                            ▲
    ├──timeout (servidor) ───────────────────────┘
    └──rechazar──► rechazado
```

**Cómo funciona**

- **Persistencia:** chats y mensajes se guardan en MongoDB (colección `chats`). En memoria quedan solo los admins conectados y los temporizadores de vencimiento, que se reconstruyen desde la base si el servidor se reinicia.
- **Híbrido REST + WebSocket:** las acciones (iniciar, aceptar, rechazar, finalizar, enviar mensaje) son endpoints `/api/chats`, protegidos por los mismos middlewares, la misma auditoría y el mismo manejo de errores que el resto de la API. Socket.io avisa a los dos participantes en tiempo real. El único evento que manda el navegador por el socket es "escribiendo…".
- **Autenticación del socket:** el handshake usa el mismo JWT (cookie `httpOnly` o header Bearer) y la misma estrategia de Passport. Si el token no es válido, el navegador vuelve al login.
- **Salas por usuario:** cada socket se une a `usuario:<id>`. Como la app es multipágina y el socket se reconecta en cada navegación, los eventos van a la sala del usuario y llegan a todas sus pestañas. Un admin que cambia de página sigue contando como conectado durante 10 segundos de gracia; si no vuelve, sus consultas pendientes pasan a otro admin.
- **Transiciones atómicas:** cada cambio de estado se aplica solo si el chat sigue en el estado esperado. Si dos acciones compiten (aceptar justo cuando vence), una gana y la otra recibe 409.

| Evento (servidor → navegador) | Destino | Cuándo |
|---|---|---|
| `chat:nuevo` | admin asignado | Consulta nueva o reasignada |
| `chat:actualizado` | ambos | Creada, aceptada o rechazada |
| `chat:mensaje` | ambos | Mensaje nuevo |
| `chat:finalizado` | ambos | Finalizada por el admin o por timeout |
| `chat:retirado` | admin anterior | La consulta pendiente pasó a otro admin |
| `chat:escribiendo` | el otro participante | Indicador "escribiendo…" |

Para probarlo, abrí dos navegadores (o una ventana normal y una privada): uno como `admin` y otro como `recepcion`. El detalle completo (diseño, flujos, archivos y verificación) está en [`docs/refactor-websockets.md`](docs/refactor-websockets.md).

---

## API REST

Todas las rutas (salvo el login) requieren un token válido, enviado en la cookie `token` (navegador) o en el header `Authorization: Bearer <token>`. Responden **401** sin token o con un token inválido, vencido o revocado, y **403** sin permiso.

```bash
TOKEN=$(curl -s -H "Content-Type: application/json" \
  -d '{"usuario":"admin","password":"admin123"}' \
  http://localhost:3000/api/auth/login | jq -r .token)

curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/clientes
```

La colección de Postman (`docs/TurnoFlex.postman_collection.json`) guarda el token de cada login y se puede correr completa en orden. Para recorrer todo el flujo de la carpeta "Chat de consultas" tiene que haber un admin conectado por Socket.io (la app abierta en el navegador como `admin`); si no lo hay, la consulta responde 503 y los pasos siguientes se saltean.

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | público | `{ usuario, password }`. Devuelve `{ token, usuario, nombre, rol }` y setea la cookie `token` |
| POST | `/api/auth/logout` | token | Invalida los tokens del usuario y borra la cookie |
| GET | `/api/auth/yo` | token | Usuario actual y sus permisos |
| GET | `/api/clientes` - `/api/clientes/:id` | clientes:read | Listar y ver detalle |
| POST | `/api/clientes` | clientes:create | Crear |
| PUT | `/api/clientes/:id` | clientes:update | Modificar |
| DELETE | `/api/clientes/:id` | clientes:delete | Eliminar |
| GET/POST/PUT/DELETE | `/api/profesionales[/:id]` | profesionales:\* | Igual que clientes |
| GET | `/api/turnos?estado=&fecha=&cliente=&profesional=` | turnos:read | Listar con filtros (por contexto) |
| GET | `/api/turnos/:id` | turnos:read | Ver detalle (por contexto) |
| POST | `/api/turnos` | turnos:create | Reservar `{ cliente, profesional, fecha, hora }` |
| PATCH | `/api/turnos/:id/estado` | turnos:update | `{ estado: "atendido" \| "cancelado" }` |
| DELETE | `/api/turnos/:id` | turnos:delete | Eliminar (solo cancelados) |
| GET | `/api/usuarios` | usuarios:read | Listar |
| POST | `/api/usuarios` | usuarios:create | Crear |
| PUT | `/api/usuarios/:id` | usuarios:update | Modificar rol, estado, vencimiento, contraseña, etc. |
| DELETE | `/api/usuarios/:id` | usuarios:delete | Eliminar |
| GET | `/api/auditoria?accion=&usuario=` | auditoria:read | Últimos 100 eventos |
| GET | `/api/chats` | chat:usar | Admin: sus chats pendientes y activos. Recepción/profesional: su consulta abierta o la última cerrada en la última hora. Incluye `maxPorAdmin` |
| GET | `/api/chats/:id` | chat:usar | Ver un chat con sus mensajes (solo participantes) |
| POST | `/api/chats` | chat:usar | Iniciar consulta `{ mensaje }`. 403 si sos admin, 409 si ya tenés una abierta, 503 sin operadores |
| POST | `/api/chats/:id/aceptar` | chat:moderar | `pendiente` → `activo` (solo el admin asignado) |
| POST | `/api/chats/:id/rechazar` | chat:moderar | `pendiente` → `rechazado` |
| POST | `/api/chats/:id/finalizar` | chat:moderar | `activo` → `finalizado` |
| POST | `/api/chats/:id/mensajes` | chat:usar | Enviar mensaje `{ texto }` (solo con el chat `activo`, 409 si no) |

---

## Declaración de uso de IA

En esta entrega usamos **Claude Code** como asistente de programación para:

- proponer un plan de trabajo acotado al alcance pedido.
- generar correcciones del código de la migración a MongoDB/Mongoose, del sistema de usuarios, roles, permisos y auditoría, y del front.
- planificar e implementar el cambio de `express-session` a Passport + JWT, verificarlo y documentarlo en `docs/refactor-passport-jwt.md`.
- rediseñar las vistas Pug con Tailwind CSS 4 (paleta, navbar, sidebar, formularios y responsive), verificarlo y documentarlo en `docs/refactor-frontend.md`.
- planificar e implementar el chat de consultas en tiempo real con Socket.io (máquina de estados, asignación de admins, timeout en el servidor y panel lateral), verificarlo y documentarlo en `docs/refactor-websockets.md`.
- redactar este README.

El grupo revisó, probó y ajustó todo el código generado. Las decisiones de diseño (roles, permisos CRUD, alcance del MVP) fueron nuestras.

---

## Bibliografía

- Documentación de Mongoose: https://mongoosejs.com/docs/
- Passport: https://www.passportjs.org/docs/
- passport-local: https://www.passportjs.org/packages/passport-local/
- passport-jwt: https://www.passportjs.org/packages/passport-jwt/
- jsonwebtoken: https://github.com/auth0/node-jsonwebtoken
- bcryptjs: https://github.com/dcodeIO/bcrypt.js
- RFC 7519, JSON Web Token: https://datatracker.ietf.org/doc/html/rfc7519
- Express 5, manejo de errores: https://expressjs.com/en/guide/error-handling.html
- Tailwind CSS 4: https://tailwindcss.com/docs
- Tailwind CSS, uso por CDN (Play CDN): https://tailwindcss.com/docs/installation/play-cdn
- Pug: https://pugjs.org/api/getting-started.html
- MDN, Fetch API: https://developer.mozilla.org/es/docs/Web/API/Fetch_API
- MongoDB Manual: https://www.mongodb.com/docs/manual/
- Socket.io v4: https://socket.io/docs/v4/
- Socket.io, salas (rooms): https://socket.io/docs/v4/rooms/
- Socket.io, middlewares y autenticación: https://socket.io/docs/v4/middlewares/
- MongoDB, índices parciales: https://www.mongodb.com/docs/manual/core/index-partial/
