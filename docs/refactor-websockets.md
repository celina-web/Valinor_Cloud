# Refactor: chat de consultas en tiempo real con WebSockets (Socket.io)

Este documento explica la incorporación del chat de consultas a TurnoFlex: qué se pidió, cómo se diseñó, qué archivos se crearon o modificaron, cómo funciona cada flujo y cómo se verificó.

---

## 1. Motivación y requisitos

Los usuarios con rol `recepcion` y `profesional` necesitaban hacerle consultas a un administrador sin salir de la aplicación. Se pidió un chat en tiempo real con **WebSockets (Socket.io)** que cumpliera estas reglas:

| # | Requisito | Cómo se cumple |
|---|---|---|
| 1 | El `admin` **no puede iniciar** conversaciones; solo recibe, acepta, rechaza o finaliza. No hay chats entre admins. | `POST /api/chats` responde 403 a un admin (control por contexto en el servicio). El admin asignado siempre es un admin conectado y el solicitante nunca puede serlo. |
| 2 | Estados explícitos: `PENDIENTE`, `ACTIVO`, `FINALIZADO`, `RECHAZADO`. | Campo `estado` del modelo `Chat` con esos cuatro valores, más `motivoCierre` (`admin`, `timeout`, `rechazo`). |
| 3 | La consulta se crea con un mensaje inicial en `PENDIENTE` y el usuario no puede escribir hasta que un admin la acepte. | `POST /api/chats/:id/mensajes` solo funciona en `activo` (409 en otro estado). La UI muestra una pantalla de espera sin campo de texto. |
| 4 | Timeout de **5 minutos** en `PENDIENTE`, controlado por el **backend**. | Temporizador en el servidor por cada chat pendiente, que se reconstruye desde Mongo si el servidor se reinicia. Al vencer pasa a `finalizado` con motivo `timeout` y se notifica a los dos. |
| 5 | Registro en memoria de los admins conectados. Cada chat se despacha a **un solo** admin. Sin admins: "Todos los operadores se encuentran ocupados en este momento". | `src/socket/presencia.js` (`Map` adminId → sockets). Se elige el admin con menor carga y, si hay empate, al azar. Sin admins disponibles, la API responde **503** con ese mensaje. |
| 6 | El admin puede **finalizar** en cualquier momento: se notifica al otro, se bloquea la interfaz y no se aceptan más mensajes. | `POST /api/chats/:id/finalizar` emite `chat:finalizado`. La UI deshabilita el formulario y ofrece "Iniciar nueva consulta". |
| 7 | Ícono de chat con badge en la navbar y **drawer lateral** desde la derecha, sin bloquear la vista. Interfaz distinta según el rol. | Botón `#btnChat` junto al avatar, drawer `includes/chatDrawer.pug` sin overlay y `src/public/js/chat.js`. |

Además se decidió, junto con el equipo:

- **Transporte híbrido:** las acciones van por REST y Socket.io solo empuja eventos del servidor al cliente (ver 2.1).
- **Límite configurable de chats por admin** (`CHAT_MAX_POR_ADMIN`): si todos los admins conectados están en el límite, también se responde "Todos los operadores se encuentran ocupados en este momento".

## 2. Decisiones de diseño

### 2.1 Híbrido REST + Socket.io

Hay dos formas de enviar las acciones del cliente: como eventos de socket (`socket.emit("chat:aceptar")`) o como requests HTTP. Se eligió **HTTP para las acciones y Socket.io para las notificaciones** por estas razones:

| Motivo | Detalle |
|---|---|
| Reutiliza toda la cadena existente | `requiereLogin` → `requierePermiso` → controlador, `tomarCampos`, `errorHandler` (400/404/409/503 en JSON), auditoría. Los handlers de socket no tienen nada de eso y habría que duplicarlo. |
| Mantiene viva la sesión | La cookie JWT se renueva solo en requests HTTP (renovación deslizante de `requiereLogin`). Si el chat fuera solo por socket, alguien que únicamente chatea perdería la sesión aunque esté usando la app. |
| Se puede probar con Postman | Los 7 endpoints quedaron en la colección (carpeta "Chat de consultas"). |
| Respuesta inmediata | El que hace la acción recibe la respuesta HTTP (con el error si lo hubo); el otro participante (y las otras pestañas del mismo usuario) se enteran por el socket. |

El único evento **cliente → servidor** es `chat:escribiendo`, que es efímero, no cambia estado y no justifica un request HTTP.

### 2.2 La app es multipágina

TurnoFlex no es una SPA: cada navegación carga una página nueva y, por lo tanto, **cierra y abre el socket**. Esto condicionó tres decisiones:

1. **Salas por usuario (`usuario:<id>`) en lugar de salas por chat.** Cada socket se une a la sala de su usuario al conectarse. Los eventos se emiten a las salas de los dos participantes. No hay que volver a unir a nadie a "la sala del chat" en cada carga de página, y funciona igual con varias pestañas abiertas.
2. **Período de gracia de 10 s para los admins.** Si un admin se queda sin sockets (porque navegó a otra página), sigue contando como conectado 10 segundos. Si no vuelve en ese tiempo, se lo da de baja y sus consultas pendientes se reasignan.
3. **El estado se lee por REST al cargar cada página** (`GET /api/chats`) y también en cada (re)conexión del socket, para recuperar lo que haya pasado mientras tanto.

### 2.3 Persistencia en MongoDB y estado mínimo en memoria

| Dónde | Qué | Por qué |
|---|---|---|
| MongoDB (`chats`) | Chat, estado, admin asignado, vencimiento y mensajes (embebidos) | Historial, auditable y sobrevive a reinicios. La **carga** de cada admin se calcula desde la base (fuente de verdad). |
| Memoria | Presencia de admins (`Map` adminId → `Set` de socketIds) y temporizadores de timeout | Son datos efímeros que pierden sentido si el proceso se reinicia: los sockets se reconectan solos y los temporizadores se reconstruyen con `recuperarTimeouts()`. |

Los mensajes van **embebidos** en el chat porque una conversación de consulta es corta, siempre se lee completa y nunca se consulta un mensaje suelto.

### 2.4 Transiciones atómicas

Cada cambio de estado es un único `findOneAndUpdate` que incluye el **estado de origen en el filtro**, por ejemplo `{ _id, estado: "pendiente", admin: yo }`. Si dos acciones compiten (el admin acepta justo cuando vence el timeout), Mongo aplica solo una y la otra no encuentra documento: se le responde **409** con un mensaje que explica el estado actual. No hace falta ningún lock.

La **asignación** (elegir un admin y crear el chat, o reasignar) sí pasa por un mutex en proceso (`encolar()`, una cadena de promesas), para que dos solicitudes simultáneas no le asignen chats a un admin por encima de su límite.

### 2.5 Autenticación del socket reutilizando Passport

El handshake de Socket.io es un request HTTP normal que trae la cookie `token`, o el header `Authorization: Bearer` si el cliente es Node o Postman. En `io.use()` se parsean las cookies con `cookie-parser` y se llama a `autenticar("jwt", req)`, el mismo helper de `src/middlewares/auth.js`. Así el socket valida exactamente lo mismo que la API:

- la firma HS256 y el vencimiento;
- `tokenVersion` (un token emitido antes de un logout o de un cambio de contraseña se rechaza);
- que el usuario exista, esté activo y no esté vencido.

Si falla, `next(new Error("NO_AUTENTICADO"))` llega al navegador como `connect_error` con ese mensaje, y el cliente redirige a `/login`. Se usa `io.use` y no `io.engine.use` justamente para que el cliente reciba ese mensaje.

## 3. Arquitectura

```
 Navegador (recepción / profesional / admin)                         Servidor Node (un proceso)
 ┌────────────────────────────────────────┐                ┌──────────────────────────────────────────┐
 │ chat.js                                │  HTTP (fetch)  │ /api/chats  (chatRoutes → chatController)│
 │  - api("/api/chats"...)  ──────────────┼───────────────►│   requiereLogin → requierePermiso        │
 │                                        │                │        │                                 │
 │  - io()  (cookie httpOnly)             │                │        ▼                                 │
 │       ▲                                │                │  services/chatService.js ─────► MongoDB  │
 │       │ chat:nuevo / actualizado /     │   WebSocket    │   (máquina de estados,          (chats)  │
 │       │ mensaje / finalizado /         │◄───────────────┤    elegirAdmin, timeouts)                │
 │       │ retirado / escribiendo         │                │        │ emitirA([...ids])               │
 │       └── chat:escribiendo ────────────┼───────────────►│        ▼                                 │
 └────────────────────────────────────────┘                │  socket/emisor.js → io.to("usuario:<id>")│
                                                           │  socket/index.js  (handshake JWT, salas) │
                                                           │  socket/presencia.js (admins conectados) │
                                                           │  services/chatTimeouts.js (setTimeout)   │
                                                           └──────────────────────────────────────────┘
```

Dependencias entre módulos (sin ciclos):

```
socket/index.js ──► services/chatService.js ──► socket/presencia.js
       │                     │                  socket/emisor.js
       │                     └────────────────► services/chatTimeouts.js
       └──► socket/emisor.js, socket/presencia.js, middlewares/auth.js
```

`emisor.js` guarda la referencia a `io` para que el servicio (y los controladores de auth y usuarios) puedan emitir o desconectar **sin requerir** `socket/index.js`, que a su vez requiere al servicio. Por el mismo motivo, `presencia.js` no requiere al servicio: este se registra con `presencia.alDarDeBajaAdmin(reasignarPendientesDe)`.

## 4. Máquina de estados

```
                 aceptar (admin asignado)                 finalizar (admin asignado)
   ┌───────────┐ ─────────────────────────► ┌──────────┐ ───────────────────────────► ┌─────────────┐
   │ pendiente │                            │  activo  │                              │ finalizado  │
   └───────────┘ ─────────────────────────────────────────────────────────────────────►│ (admin /    │
        │          timeout (servidor, CHAT_TIMEOUT_MINUTOS)                            │  timeout)   │
        │                                                                              └─────────────┘
        │ rechazar (admin asignado)        ┌───────────┐
        └─────────────────────────────────►│ rechazado │      finalizado y rechazado son finales
                                           └───────────┘
```

| Transición | Filtro atómico | Quién | Efectos |
|---|---|---|---|
| crear → `pendiente` | sin otro chat abierto del usuario | recepción / profesional | Elige admin, crea el chat con el mensaje inicial, programa el timeout, emite `chat:nuevo` al admin y `chat:actualizado` al solicitante, audita `CREAR` |
| `pendiente` → `activo` | `{ _id, estado: "pendiente", admin: yo }` | admin asignado | `aceptadoEl`, cancela el timeout, emite `chat:actualizado` a ambos, audita `CAMBIO_ESTADO` |
| `pendiente` → `rechazado` | ídem | admin asignado | `motivoCierre: "rechazo"`, `cerradoEl`, cancela el timeout, emite `chat:actualizado`, audita |
| `pendiente` → `finalizado` | `{ _id, estado: "pendiente" }` | temporizador | `motivoCierre: "timeout"`, emite `chat:finalizado` a ambos, audita como `sistema` |
| `activo` → `finalizado` | `{ _id, estado: "activo", admin: yo }` | admin asignado | `motivoCierre: "admin"`, emite `chat:finalizado`, audita |
| agregar mensaje | `{ _id, estado: "activo", $or: [{ solicitante: yo }, { admin: yo }] }` | cualquiera de los dos | `$push` del mensaje, emite `chat:mensaje` a ambos (incluido el emisor, para sus otras pestañas) |

Cuando una transición no se puede aplicar, `errorDeTransicion()` arma la respuesta:

- **404** si el chat no existe o si quien pregunta no es participante y no es admin (no se revela que existe);
- **409** "La consulta está asignada a otro operador" si es otro admin;
- **409** con el estado actual ("La consulta todavía no fue aceptada", "La conversación ya fue finalizada", etc.) en el resto de los casos.

## 5. Backend

### 5.1 Modelo `Chat` (`src/models/Chat.js`)

| Campo | Tipo | Notas |
|---|---|---|
| `solicitante` | ObjectId → Usuario | Quien inició la consulta |
| `rolSolicitante` | `recepcion` \| `profesional` | Se guarda para mostrarlo aunque el usuario cambie de rol después |
| `admin` | ObjectId → Usuario | Admin asignado. Cambia si se reasigna mientras está pendiente |
| `estado` | `pendiente` \| `activo` \| `finalizado` \| `rechazado` | Por defecto `pendiente` |
| `motivoCierre` | `admin` \| `timeout` \| `rechazo` \| `null` | Por qué se cerró |
| `expiraEl` | Date | Creación + `CHAT_TIMEOUT_MINUTOS`. No cambia al reasignar |
| `aceptadoEl`, `cerradoEl` | Date | Fechas de las transiciones |
| `mensajes` | `[{ _id, autor, texto, createdAt }]` | `texto` con trim, de 1 a 1000 caracteres |
| `createdAt`, `updatedAt` | `timestamps` | |

Índices:

| Índice | Uso |
|---|---|
| `{ admin: 1, estado: 1 }` | Calcular la carga de cada admin y listar sus chats |
| `{ estado: 1, expiraEl: 1 }` | Recuperar los timeouts pendientes al arrancar |
| `{ solicitante: 1, createdAt: -1 }` | Último chat del usuario |
| `{ solicitante: 1 }` **único parcial** con `estado ∈ {pendiente, activo}` (`un_chat_abierto_por_usuario`; `$in` en un índice parcial requiere MongoDB 6.0 o superior, que ya es el mínimo del proyecto) | Garantiza en la base que un usuario no tenga dos chats abiertos. Respalda el chequeo del servicio; si se viola, el `errorHandler` responde 409 |

Exporta `ESTADOS`, `ABIERTOS` y `MAX_TEXTO`, igual que `Auditoria.ACCIONES`.

### 5.2 Configuración (`src/config/chat.js`)

| Constante | Origen | Por defecto |
|---|---|---|
| `CHAT_MAX_POR_ADMIN` | `.env` | `3` |
| `CHAT_TIMEOUT_MS` | `.env` `CHAT_TIMEOUT_MINUTOS` (acepta decimales, por ejemplo `0.5` para probar) | 5 minutos |
| `GRACIA_DESCONEXION_MS` | fija | 10 s |
| `MENSAJE_SIN_OPERADORES` | fija | "Todos los operadores se encuentran ocupados en este momento" |

### 5.3 Servicio (`src/services/chatService.js`)

Concentra toda la lógica de negocio. Lo usan los controladores REST, el servidor de sockets y los temporizadores.

| Función | Qué hace |
|---|---|
| `listarChats(usuario)` | Admin: sus chats `pendiente` y `activo`, con mensajes y los datos de los dos participantes. Recepción/profesional: su chat abierto o, si no tiene, el último que se cerró **en la última hora** (para que vea cómo terminó sin arrastrar conversaciones viejas). |
| `obtenerChat(usuario, id)` | Chat completo; 404 si no sos participante. |
| `iniciarChat(req, texto)` | Valida el rol (403 a un admin) y el texto (400). Dentro del mutex: verifica que no tenga otro abierto (409), llama a `elegirAdmin()` (si devuelve `null`, audita `CHAT_SIN_OPERADOR` y responde 503), crea el chat, programa el timeout, emite y audita. |
| `elegirAdmin({ excluir })` | Toma los admins conectados, calcula la carga con un `aggregate` (`$match` admin ∈ conectados, estado ∈ abiertos; `$group` por admin), descarta los que llegaron al límite y elige el de menor carga (empate al azar). |
| `aceptarChat`, `rechazarChat`, `finalizarChat` | Transiciones atómicas (ver la sección 4). |
| `enviarMensaje(req, id, texto)` | Valida, hace el `$push` atómico y emite `chat:mensaje` a ambos participantes. |
| `expirar(id)` | Callback del temporizador: `pendiente` → `finalizado`/`timeout`. Audita como `sistema`. |
| `recuperarTimeouts()` | Al arrancar el servidor, reprograma un temporizador por cada chat pendiente. Los ya vencidos expiran enseguida. |
| `reasignarPendientesDe(adminId)` | Cuando un admin queda dado de baja (pasó la gracia), mueve sus pendientes a otro admin disponible. Emite `chat:retirado` al anterior y `chat:nuevo` al nuevo, y audita `MODIFICAR`. Si no hay ninguno disponible, quedan pendientes hasta que se conecte otro admin o venza el timeout. |
| `asignarHuerfanos(adminId)` | Cuando un admin se conecta, toma los pendientes cuyo admin ya no está conectado, hasta su límite. Durante los primeros 10 s después de arrancar el servidor no hace nada, para que cada admin recupere los suyos al reconectarse. |
| `liberarChatsDeAdmin(adminId)` | Si un admin es desactivado, eliminado o cambia de rol, se finalizan sus conversaciones activas y se reasignan sus pendientes. |
| `reenviarEscribiendo(usuario, chatId)` | Valida que el chat esté activo y que el usuario sea participante, y reenvía `chat:escribiendo` al otro. |

Para auditar acciones que hace el propio servidor (timeouts, reasignaciones) se usa un pseudo-request `{ ip: null }` y `usuarioNombre: "sistema"`; `registrarAuditoria` ya tolera un request sin usuario.

> **`sanitizeFilter`:** `src/config/db.js` activa `mongoose.set("sanitizeFilter", true)`, que neutraliza los operadores `$` dentro de los filtros, una protección contra inyecciones NoSQL. Por eso los filtros con operadores escritos por el servidor se marcan con `mongoose.trusted(...)`, por ejemplo `estado: trusted({ $in: ABIERTOS })`. Los datos que vienen del cliente nunca pasan por `trusted`.

### 5.4 Temporizadores (`src/services/chatTimeouts.js`)

- `programar(chatId, fecha, alVencer)`: crea un `setTimeout` hasta `expiraEl` y lo guarda en un `Map`. Si el chat ya tenía uno, lo reemplaza. Se usa `.unref()` para que el temporizador no impida que el proceso termine.
- `cancelar(chatId)`: se llama al aceptar o rechazar.
- Si dos cosas pasan casi juntas (el timer dispara justo cuando el admin acepta), decide el filtro atómico de `expirar()`: solo cambia el chat si todavía está `pendiente`.

### 5.5 Presencia de admins (`src/socket/presencia.js`)

```
conectar(admin, socket)     → cancela la gracia pendiente y agrega el socket al Set
desconectar(admin, socket)  → saca el socket; si el Set queda vacío, arranca la gracia de 10 s
   gracia vencida           → darDeBaja(admin) → callback del servicio: reasignarPendientesDe(admin)
adminsConectados()          → ids con al menos un socket o dentro de la gracia
```

### 5.6 Servidor Socket.io (`src/socket/index.js` y `src/socket/emisor.js`)

- `src/index.js` ahora crea `http.createServer(app)`. Express y Socket.io comparten el puerto, y el cliente se sirve solo en `/socket.io/socket.io.js` (no hace falta CDN). Al arrancar se llama a `recuperarTimeouts()` antes de `listen`.
- **Handshake:** se hace en `io.use(autenticarSocket)` (ver 2.5). En `socket.data` se guardan el usuario (`_id`, `usuario`, `nombre`, `rol`) y el `exp` del token.
- **Conexión:** el socket se une a `usuario:<id>`. Si es admin, se registra en la presencia y se llama a `asignarHuerfanos`. También se escucha `chat:escribiendo`.
- **Vencimiento del token:** el socket no se entera de que la cookie se renovó. Cuando vence el token con el que se conectó, el servidor lo desconecta y el cliente vuelve a conectarse con la cookie vigente. Si esa cookie ya no sirve, recibe `NO_AUTENTICADO` y vuelve al login.
- **`emisor.js`:** `emitirA(ids, evento, datos)` emite a `io.to(["usuario:a", "usuario:b"])` (Socket.io no repite un evento a un socket que está en las dos salas), y `desconectarUsuario(id)` hace `io.in("usuario:<id>").disconnectSockets(true)`.

### 5.7 Eventos

**Servidor → cliente**

| Evento | Destino | Payload | Cuándo |
|---|---|---|---|
| `chat:nuevo` | admin asignado | chat completo | Se creó una consulta para él, o se la reasignaron |
| `chat:actualizado` | ambos | chat completo | Creación (al solicitante), aceptación o rechazo |
| `chat:mensaje` | ambos | `{ chatId, mensaje: { _id, autor, texto, createdAt } }` | Mensaje nuevo |
| `chat:finalizado` | ambos | `{ chatId, estado, motivo, cerradoEl }` | Lo finalizó el admin, venció el timeout o el admin fue dado de baja |
| `chat:retirado` | admin anterior | `{ chatId, motivo: "reasignado" }` | El pendiente pasó a otro admin |
| `chat:escribiendo` | el otro participante | `{ chatId }` | Indicador de "escribiendo…" |

**Cliente → servidor**

| Evento | Payload | Validación |
|---|---|---|
| `chat:escribiendo` | `{ chatId }` | id válido, chat `activo` y el usuario es participante; si no, se ignora |

### 5.8 API REST (`src/routes/api/chatRoutes.js` + `src/controllers/chatController.js`)

Todas las rutas pasan por `requiereLogin`.

| Método | Ruta | Permiso | Respuestas |
|---|---|---|---|
| GET | `/api/chats` | `chat:usar` | 200 `{ chats: [...], maxPorAdmin }` |
| GET | `/api/chats/:id` | `chat:usar` | 200 chat · 404 si no sos participante · 400 si el id es inválido |
| POST | `/api/chats` | `chat:usar` | Body `{ mensaje }`. 201 · 400 si está vacío o tiene más de 1000 caracteres · 403 si sos admin · 409 si ya tenés uno abierto · **503** sin operadores |
| POST | `/api/chats/:id/aceptar` | `chat:moderar` | 200 · 409 |
| POST | `/api/chats/:id/rechazar` | `chat:moderar` | 200 · 409 |
| POST | `/api/chats/:id/finalizar` | `chat:moderar` | 200 · 409 |
| POST | `/api/chats/:id/mensajes` | `chat:usar` | Body `{ texto }`. 201 mensaje · 400 · 404 · 409 si el chat no está activo |

Los bodies pasan por `tomarCampos()` (solo se toma `mensaje` o `texto`). Los usuarios se populan con `nombre usuario rol`; `toJSON` de `Usuario` ya excluye `password` y `tokenVersion`.

### 5.9 Errores de negocio (`src/helpers/errores.js` y `src/middlewares/errores.js`)

Se agregó `crearError(status, mensaje)`, que crea un `Error` con `status` y `expuesto: true`. El `errorHandler` ahora responde esos errores con **su propio mensaje** y su status (incluido el 503). Antes, cualquier error 4xx genérico se respondía como "La solicitud no es válida". El resto del comportamiento no cambió.

### 5.10 Permisos (`src/config/roles.js`)

| Permiso | profesional | recepcion | admin |
|---|:-:|:-:|:-:|
| `chat:usar` | ✓ | ✓ (heredado) | ✓ (heredado) |
| `chat:moderar` | – | – | ✓ |

`chat:usar` se agregó al rol base y se hereda por el spread de arrays. Que un admin **no pueda iniciar** se resuelve con **control por contexto** en el servicio, como ya se hacía con las reglas de turnos: no se rompe la jerarquía de roles quitándole un permiso al admin.

### 5.11 Auditoría

| Acción | Cuándo | Autor |
|---|---|---|
| `CHAT_SIN_OPERADOR` (**nueva**) | Se rechazó una apertura con 503 | el solicitante |
| `CREAR` (entidad `Chat`) | Consulta creada, con el admin asignado en el detalle | el solicitante |
| `CAMBIO_ESTADO` (entidad `Chat`) | Aceptar, rechazar, finalizar, timeout, cierre porque el admin fue dado de baja | el admin, o `sistema` |
| `MODIFICAR` (entidad `Chat`) | Reasignación de un pendiente | `sistema` |

Los mensajes **no** se auditan (quedan en el propio chat). En la pantalla de Auditoría, `CHAT_SIN_OPERADOR` se muestra con la etiqueta de peligro.

### 5.12 Revocación de sockets

Un socket se autentica una sola vez, en el handshake. Para que un cambio de permisos tenga efecto inmediato, el servidor cierra los sockets afectados:

| Dónde | Cuándo se llama a `desconectarUsuario(id)` |
|---|---|
| `authController.logout` | Siempre (el logout ya invalida los tokens de todos los dispositivos) |
| `usuariosController.actualizarUsuario` | Cuando a **otro** usuario se le desactiva la cuenta, se le cambia el rol, se le pone vencimiento o se le cambia la contraseña. Si es la propia cuenta del admin no se desconecta, porque el admin recibe un token nuevo en la misma respuesta. |
| `usuariosController.eliminarUsuario` | Siempre |

Si el usuario afectado era admin, además se llama a `liberarChatsDeAdmin()`. El cliente, al ver `io server disconnect`, intenta reconectarse a los 1 s: si su token sigue siendo válido, vuelve a entrar; si no, recibe `NO_AUTENTICADO` y va a `/login`.

## 6. Frontend

### 6.1 Navbar (`src/views/includes/navbar.pug`)

- A la izquierda del avatar se agregó `button#btnChat`, que solo se muestra si `puede("chat:usar")`. Tiene el ícono `mensajes` y un badge `#badgeChat`.
- **Badge:** cantidad de chats abiertos (admin: pendientes + activos; recepción/profesional: 1 si su consulta está pendiente o activa). Pulsa (`animate-pulse`) cuando hay novedades sin ver. El `aria-label` del botón incluye la cantidad.
- Se agregaron tres íconos a `mixins.pug`: `mensajes`, `enviar` y `volver`.

### 6.2 Drawer (`src/views/includes/chatDrawer.pug`)

- `aside#drawerChat`: `fixed top-16 right-0 bottom-0`, ancho completo en móvil y `sm:w-96` desde tablet. Entra con `translate-x-full` → `chat-abierto:translate-x-0` y transición de `translate` y `visibility`. Al estar `invisible` cuando está cerrado, sus controles no se pueden enfocar con Tab.
- **Sin overlay:** la página de atrás sigue usable con el chat abierto (requisito "sin bloquear la vista principal").
- Se abre y cierra con el botón de la navbar, con el botón × o con Escape (si el foco está dentro del drawer). El estado se guarda en `sessionStorage` (`turnoflex:chat`) y `layouts/base.pug` lo restaura **antes de pintar**, así el drawer sigue abierto al navegar entre páginas.
- **Recepción / profesional**, con paneles que se alternan con `hidden`:
  1. `#chatInicio`: texto explicativo, textarea (máximo 1000 caracteres, con contador) y el botón "Enviar consulta".
  2. `#chatEspera`: indicador animado, "Esperando que un operador acepte tu consulta", cuenta regresiva y el mensaje enviado. **No hay campo de texto.**
  3. `#chatConversacion`: burbujas de mensajes, formulario (Enter envía, Shift+Enter agrega un salto de línea) e indicador "Escribiendo…".
  4. `#chatCierre` (dentro de la conversación): aviso según el motivo ("El operador finalizó la conversación…", "Ningún operador aceptó tu consulta a tiempo…", "Tu consulta fue rechazada…") y el botón "Iniciar nueva consulta". La conversación queda en solo lectura.
- **Admin:**
  1. `#chatLista`: carga "n / máximo", sección "Pendientes de aceptación" con tarjetas (nombre, rol, mensaje inicial, "Expira en m:ss", botones **Aceptar** y **Rechazar**) y sección "Conversaciones activas" (nombre, último mensaje y un punto rojo si hay mensajes sin leer).
  2. Conversación: botón volver, nombre y usuario del solicitante en la cabecera, barra con la hora de inicio y el botón **Finalizar conversación** (pide confirmación), mensajes y formulario.

### 6.3 Tema (`src/views/includes/tema.pug`)

- Nueva variante: `@custom-variant chat-abierto (&:where([data-chat="abierto"] *));`.
- Componentes nuevos, que comparten la vista y el JS:
  - `.burbuja`, `.burbuja-propia` (color de marca, alineada a la derecha) y `.burbuja-ajena` (blanca con borde, a la izquierda);
  - `.estado-chat-pendiente` (mostaza), `-activo` (oliva), `-finalizado` (gris) y `-rechazado` (coral), que reutilizan la paleta de los turnos.

### 6.4 Scripts (`src/views/layout.pug`)

Solo para usuarios con `chat:usar`, se cargan con `defer` `/socket.io/socket.io.js` (servido por el backend, de la misma versión) y `/js/chat.js`. Con `defer` corren en orden **después** de `api.js`, que está al final del `body`, así `chat.js` puede usar `api()`, `mostrarError()`, `crearBoton()`, `crearEtiqueta()`, `formatearFechaHora()` e `idUsuarioActual`.

### 6.5 `src/public/js/chat.js`

Va dentro de una IIFE, como `layout.js`.

- **Estado local:** `chats` (`Map` id → chat), `abiertoId` (la conversación que está mirando el admin), `noLeidos` (`Set`) y `maxPorAdmin`.
- **Carga:** `GET /api/chats` cada vez que el socket se conecta o se reconecta, para recuperar lo que pasó durante la navegación o un corte.
- **Acciones:** todas con `api()` por POST. Si falla (por ejemplo, la consulta expiró justo antes de aceptarla), se muestra el error en `#errorChat` y se resincroniza con el servidor.
- **Mensajes sin render optimista:** se muestra lo que confirmó el servidor. Como el mismo mensaje llega por la respuesta HTTP y por el eco `chat:mensaje`, se deduplica por `_id`.
- **Render incremental de burbujas:** solo se agregan los mensajes nuevos al `<ol aria-live="polite">`, para que el lector de pantalla no relea toda la conversación. El scroll baja solo si el usuario ya estaba cerca del final.
- **Leídos:** un chat cuenta como "a la vista" si el drawer está abierto y (admin) es la conversación abierta o es un pendiente con la lista a la vista. Lo demás queda marcado como no leído y hace pulsar el badge.
- **Cuenta regresiva:** un `setInterval` de 1 s actualiza los elementos con `data-expira`. Solo informa: el timeout real lo decide el servidor.
- **"Escribiendo…":** se emite como mucho cada 2 s mientras se escribe y se oculta a los 3 s.
- **Sesión:** si `connect_error` trae `NO_AUTENTICADO`, se redirige a `/login`. Si el servidor cierra el socket, se reintenta la conexión a 1 s. Al cerrar sesión se limpian las claves de `sessionStorage`.
- **Seguridad:** todo el contenido que escriben los usuarios se inserta con `textContent`, nunca con `innerHTML`, así un mensaje como `<b>hola</b>` se muestra literal.

## 7. Flujos

### 7.1 Iniciar una consulta

```
Recepción                    Servidor                                         Admin elegido
  | POST /api/chats {mensaje}
  |--------------------------->| requiereLogin, requierePermiso("chat:usar")
  |                            | rol admin → 403 · texto inválido → 400
  |                            | encolar(
  |                            |   ¿ya tiene uno abierto? → 409
  |                            |   elegirAdmin(): conectados, carga < máximo, menor carga
  |                            |     ninguno → auditoría CHAT_SIN_OPERADOR → 503 "Todos los operadores…"
  |                            |   Chat.create({ estado: pendiente, expiraEl, mensajes:[inicial] })
  |                            |   programar timeout
  |                            | )
  |<---------------------------| 201 chat  ─── chat:nuevo ──────────────────────────────►| badge +1, tarjeta en "Pendientes"
  |<-- chat:actualizado (otras pestañas)
  | UI: pantalla de espera, sin campo de texto
```

### 7.2 Aceptar y conversar

```
Admin: POST /api/chats/:id/aceptar → findOneAndUpdate({estado:"pendiente", admin:yo}) → cancelar timeout
       → chat:actualizado a ambos → la recepción pasa a la conversación y se habilita el formulario
Cualquiera: POST /api/chats/:id/mensajes {texto} → $push atómico (solo si activo) → chat:mensaje a ambos
```

### 7.3 Timeout

```
setTimeout(expiraEl) → expirar(id): findOneAndUpdate({estado:"pendiente"}) → finalizado/timeout
  → chat:finalizado a ambos: la recepción ve "Ningún operador aceptó tu consulta a tiempo"
    y el admin deja de ver la tarjeta → auditoría como "sistema"
Reinicio del servidor → recuperarTimeouts() reprograma todos los pendientes (los vencidos expiran ya)
```

### 7.4 Finalizar o rechazar

```
Admin: POST /:id/finalizar (activo) o /:id/rechazar (pendiente) → chat:finalizado / chat:actualizado
  → la recepción ve el aviso, el formulario desaparece y cualquier POST de mensajes responde 409
  → "Iniciar nueva consulta" vuelve al formulario inicial
```

### 7.5 Admin que se desconecta

```
Cierra la pestaña o navega → disconnect → presencia.desconectar → sin sockets → gracia de 10 s
  vuelve antes (navegación normal) → conectar() cancela la gracia, no pasa nada
  no vuelve → darDeBaja → reasignarPendientesDe(admin): cada pendiente pasa a otro admin disponible
              (chat:retirado al anterior, chat:nuevo al nuevo, auditoría MODIFICAR)
Otro admin se conecta → asignarHuerfanos: toma los pendientes cuyo admin ya no está, hasta su límite
```

Las conversaciones **activas** de un admin que se desconecta no se tocan: puede volver y seguir. Solo se cierran si el admin es desactivado, eliminado o cambia de rol.

## 8. Cambios archivo por archivo

**Nuevos**

| Archivo | Contenido |
|---|---|
| `src/models/Chat.js` | Modelo, estados, índices (incluido el único parcial) |
| `src/config/chat.js` | Límite por admin, timeout, gracia y mensaje "sin operadores" |
| `src/helpers/errores.js` | `crearError(status, mensaje)` |
| `src/services/chatService.js` | Máquina de estados, asignación, reasignación, timeouts, "escribiendo" |
| `src/services/chatTimeouts.js` | Temporizadores en memoria |
| `src/socket/index.js` | `iniciarSocket(servidor)`: handshake JWT, salas, presencia, vencimiento del token |
| `src/socket/emisor.js` | `emitirA`, `desconectarUsuario`, `salaDeUsuario` |
| `src/socket/presencia.js` | Admins conectados con período de gracia |
| `src/controllers/chatController.js` | Controladores REST finos que llaman al servicio |
| `src/routes/api/chatRoutes.js` | Rutas `/api/chats` con sus permisos |
| `src/views/includes/chatDrawer.pug` | Drawer del chat (vista por rol) |
| `src/public/js/chat.js` | Cliente: estado, render, acciones REST y eventos de Socket.io |
| `docs/refactor-websockets.md` | Este documento |

**Modificados**

| Archivo | Cambio |
|---|---|
| `package.json` / `package-lock.json` | Dependencia `socket.io` ^4.8 |
| `src/index.js` | `http.createServer(app)`, `iniciarSocket`, `recuperarTimeouts()` y la ruta `/api/chats` |
| `src/config/roles.js` | Permisos `chat:usar` (profesional, y por herencia los demás) y `chat:moderar` (admin) |
| `src/models/Auditoria.js` | Acción `CHAT_SIN_OPERADOR` |
| `src/middlewares/errores.js` | Responde con su mensaje los errores con `expuesto: true` (incluido el 503) |
| `src/controllers/authController.js` | El logout cierra los sockets del usuario |
| `src/controllers/usuariosController.js` | Cierra los sockets al quitar permisos o eliminar, y libera los chats si el usuario era admin |
| `src/views/includes/navbar.pug` | Botón del chat con badge al lado del avatar |
| `src/views/includes/mixins.pug` | Íconos `mensajes`, `enviar` y `volver` |
| `src/views/includes/tema.pug` | Variante `chat-abierto` y clases `.burbuja*` y `.estado-chat-*` |
| `src/views/layout.pug` | Incluye el drawer y los scripts de Socket.io y del chat |
| `src/views/layouts/base.pug` | Restaura el drawer abierto desde `sessionStorage` antes de pintar |
| `src/public/js/auditoria.js` | `CHAT_SIN_OPERADOR` con etiqueta de peligro |
| `src/seed.js` | Limpia `chats`, sincroniza sus índices y crea un segundo admin (`admin2` / `admin123`) |
| `.env.example` | `CHAT_MAX_POR_ADMIN` y `CHAT_TIMEOUT_MINUTOS` |
| `docs/TurnoFlex.postman_collection.json` | Carpeta "Chat de consultas" (13 requests) y variable `chatId` |
| `docs/Docker/docker-readme.md` | Variables del chat |
| `README.md`, `CLAUDE.md` | Documentación de la funcionalidad |

**Diferencias con el plan original**

- La referencia a `io` quedó en un módulo propio (`socket/emisor.js`) para evitar dependencias circulares entre el socket, el servicio y los controladores.
- La autenticación del handshake se hace en `io.use` y no en `io.engine.use`, para que el navegador reciba el motivo (`NO_AUTENTICADO`) en `connect_error`.
- El timeout se informa al admin con `chat:finalizado` (el mismo evento que recibe el solicitante) y no con `chat:retirado`, que quedó solo para las reasignaciones.
- Se agregó `liberarChatsDeAdmin()` para el caso de un admin desactivado o eliminado con chats abiertos.
- El "último chat cerrado" que ve el solicitante se limita a la última hora.

## 9. Configuración y puesta en marcha

```bash
npm install                       # instala socket.io
npm run seed                      # crea admin2 y limpia los chats (BORRA la base)
npm run dev
```

Con Docker hay que **reconstruir renovando `node_modules`**, porque el volumen anónimo conserva las dependencias viejas:

```bash
docker compose up --build -V
docker compose exec app npm run seed
```

Variables nuevas (opcionales) en `.env`:

```dotenv
CHAT_MAX_POR_ADMIN=3        # chats abiertos (pendientes + activos) por admin
CHAT_TIMEOUT_MINUTOS=5      # acepta decimales: 0.5 = 30 segundos, útil para probar
```

## 10. Verificación

Se probó contra una base aparte (`turnoflex_chat_test`), con `CHAT_MAX_POR_ADMIN=1` o `2` y `CHAT_TIMEOUT_MINUTOS` entre `0.25` y `0.5`.

**API + Socket.io (script con `socket.io-client`, 39 comprobaciones):**

- sin admins conectados → 503 con el mensaje pedido y auditoría `CHAT_SIN_OPERADOR`;
- socket sin token → `connect_error: NO_AUTENTICADO`;
- mensaje vacío → 400; mensaje de más de 1000 caracteres → 400;
- creación → 201 `pendiente`; el admin recibe `chat:nuevo` y el solicitante `chat:actualizado`; la respuesta no expone `password` ni `tokenVersion`;
- segundo chat abierto → 409; un admin que inicia → 403; con el límite alcanzado → 503; mensaje en `pendiente` → 409; recepción que intenta aceptar → 403;
- con `admin2` conectado, el chat nuevo se le asigna a `admin2` (menor carga);
- `admin2` acepta un chat ajeno → 409; usuario ajeno pide el chat → 404; id inválido → 400;
- aceptar → `activo` en los dos lados; intercambio de mensajes en tiempo real (los dos reciben cada `chat:mensaje`); intruso que envía → 404; "escribiendo" reenviado;
- finalizar → los dos reciben `chat:finalizado`; mensaje posterior → 409; se puede iniciar una consulta nueva;
- rechazar → `rechazado` notificado;
- timeout → los dos reciben `chat:finalizado` con motivo `timeout`; aceptar después → 409;
- reasignación: se cierra el socket del admin asignado y a los ~10 s el otro admin recibe `chat:nuevo`;
- logout → el socket se cierra con `io server disconnect` y reconectar con el token viejo → `NO_AUTENTICADO`.

**Reinicio:** con un chat pendiente, se reinició el servidor; el log mostró "1 consulta(s) pendiente(s) con timeout reprogramado" y el chat expiró a tiempo.

**Baja de admin:** desactivar a un admin con una conversación activa cerró su socket, finalizó la conversación (el solicitante recibió `chat:finalizado`) y quedó auditado como `sistema`.

**Interfaz (Chromium headless con Playwright, 28 comprobaciones):**

- aviso de operadores ocupados;
- pantalla de espera sin campo de texto, con cuenta regresiva y badge;
- badge del admin pulsando, tarjeta pendiente con el mensaje y carga "1 / 2";
- aceptar → conversación en los dos lados;
- mensajes con Enter, burbujas propias y ajenas, "Escribiendo…";
- el drawer sigue abierto y conserva la conversación al navegar (recepción y admin);
- punto de no leído en la lista del admin;
- HTML escapado (`<b>sin html</b>` se muestra literal);
- finalizar → formulario bloqueado, aviso y "Iniciar nueva consulta";
- timeout reflejado en los dos lados;
- en un móvil de 390 px, el drawer ocupa todo el ancho sin scroll horizontal;
- Escape cierra el drawer;
- logout → `/login`;
- sin errores de JavaScript en la consola. El único mensaje es el log del navegador por la respuesta 503 esperada.

**Postman (newman):**

- La colección completa (51 requests) pasa sin admin conectado: la consulta responde 503 y los pasos que dependen de ella se saltean.
- Con un admin conectado por socket, la carpeta "Chat de consultas" recorre todo el flujo (201 → 409 → aceptar → mensaje → 404 → finalizar → 409) sin fallas.

## 11. Limitaciones y trabajo futuro

- **Un solo proceso de Node.** La presencia de admins y los temporizadores viven en memoria. Para correr varias instancias haría falta `@socket.io/redis-adapter`, presencia compartida en Redis y un único responsable de los timeouts, por ejemplo un job o una cola con vencimiento.
- **Reasignación después de un reinicio.** Durante los primeros 10 s después de arrancar, no se reasignan pendientes, para que cada admin recupere los suyos. Si el admin de un pendiente no vuelve, ese chat pasa al próximo admin que se conecte, o expira.
- **Sin historial para el admin.** El admin solo ve los chats abiertos; los cerrados quedan en la base y en la auditoría. Una vista de historial sería un agregado natural.
- **El usuario no puede cancelar su consulta pendiente**, porque el enunciado no contemplaba esa transición. Se podría agregar un `pendiente → finalizado` con motivo `cancelado`.

## Bibliografía

- Socket.io v4, documentación: https://socket.io/docs/v4/
- Socket.io, middlewares y autenticación: https://socket.io/docs/v4/middlewares/
- Socket.io, salas (rooms): https://socket.io/docs/v4/rooms/
- Socket.io, uso con Passport: https://socket.io/how-to/use-with-passport
- Mongoose, `findOneAndUpdate` y `sanitizeFilter`: https://mongoosejs.com/docs/tutorials/findoneandupdate.html · https://mongoosejs.com/docs/api/mongoose.html#Mongoose.prototype.trusted()
- MongoDB, índices parciales: https://www.mongodb.com/docs/manual/core/index-partial/
- MDN, `sessionStorage`: https://developer.mozilla.org/es/docs/Web/API/Window/sessionStorage
