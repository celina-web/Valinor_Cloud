# TurnoFlex: Sistema de Gestión de Turnos

TurnoFlex es una aplicación web, hecha con **Node.js**, **Express** y **MongoDB** (con Mongoose), para gestionar los
turnos de un centro de atención. Permite administrar profesionales, clientes y turnos, aplicando reglas de negocio. Es un **producto mínimo viable** con:

- Persistencia en **MongoDB** usando Mongoose.
- **Usuarios con login**, mediante sesiones con `express-session`.
- **Roles jerárquicos y permisos CRUD**: `admin` > `recepcion` > `profesional`.
- **Auditoría** de todas las acciones relevantes.
- **Front con `fetch`**: las pantallas cargan y guardan datos de forma asincrónica, sin recargar la página.

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

### Variables de entorno (`.env`)

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `MONGO_URI` | Cadena de conexión a MongoDB | `mongodb://127.0.0.1:27017/turnoflex` |
| `SESSION_SECRET` | Para firmar la cookie de sesión | `secreto-sesion` |
| `SESSION_MINUTOS` | Minutos de inactividad antes de que la sesión expire | `30` |

### Usuarios de prueba (creados por `npm run seed`)

| Usuario | Contraseña | Rol | Contexto |
|---|---|---|---|
| `admin` | `admin123` | admin | Todo el sistema |
| `recepcion` | `recepcion123` | recepcion | Clientes, profesionales y turnos |
| `profesional1` | `prof1234` | profesional | Solo los turnos de la instructora Ferreyra |
| `profesional2` | `prof5678` | profesional | Solo los turnos del instructor Acosta |

---

## Estructura del proyecto

```
Valinor_Cloud/
├── .env.example
├── docs/
│   └── TurnoFlex.postman_collection.json
└── src/
    ├── index.js                         Configura Express, sesión, rutas y errores; conecta a Mongo
    ├── seed.js                          Carga datos y usuarios de prueba
    ├── config/
    │   ├── db.js                        Conexión a MongoDB con Mongoose
    │   └── roles.js                     Roles, jerarquía y permisos CRUD
    ├── models/                          Esquemas de Mongoose
    │   ├── Cliente.js  Profesional.js  Turno.js
    │   ├── Usuario.js                   Usuario, rol, estado, vencimiento y fechas
    │   └── Auditoria.js                 Registro de eventos
    ├── controllers/                     Lógica de cada recurso (async/await)
    ├── routes/
    │   ├── api/                         API REST en JSON (/api/...)
    │   └── vistasRoutes.js              Páginas Pug
    ├── middlewares/
    │   ├── auth.js                      requiereLogin y requierePermiso
    │   ├── errores.js                   404 y manejo centralizado de errores
    │   └── logger.js                    Log de cada request
    ├── helpers/
    │   ├── auditoria.js                 registrarAuditoria()
    │   └── campos.js                    tomarCampos(): solo acepta campos permitidos
    ├── views/                           Plantillas Pug (layout, login, panel y ABMs)
    └── public/
        ├── estilos.css
        └── js/                          JS del navegador (fetch a la API)
```

### Cómo funciona

1. **Vistas y API separadas.** Las rutas de `vistasRoutes.js` solo renderizan la estructura de cada página con Pug. Los datos los pide el navegador con `fetch` a `/api/...`, que siempre responde JSON.
2. **Sin recargas.** Al guardar, editar o eliminar, el JS envía la petición, espera la respuesta con `await` y vuelve a dibujar la tabla. Si hay un error de validación, se muestra al lado del formulario.
3. **Middlewares en cadena.** Cada ruta pasa por `requiereLogin` y luego por `requierePermiso("recurso:accion")` antes de llegar al controlador.
4. **Errores centralizados.** Express 5 envía al `errorHandler` los errores de los controladores `async`. Ese middleware traduce los errores de Mongoose a respuestas claras:

   | Error | Respuesta |
   |---|---|
   | Validación | 400 |
   | Id inválido | 400 |
   | Dato duplicado | 409 |

---

## Modelos (MongoDB)

Todos los modelos usan `timestamps`, así que guardan `createdAt` (fecha de creación) y `updatedAt` (fecha de modificación).

| Colección | Campos principales | Validaciones |
|---|---|---|
| `clientes` | nombre, apellido, dni, telefono, email | dni único de 7 u 8 números, email válido |
| `profesionales` | nombre, apellido, especialidad, matricula | matrícula única |
| `turnos` | cliente (ref), profesional (ref), fecha, hora, estado, creadoPor (ref) | fecha `YYYY-MM-DD`, hora `HH:mm`, estado en `reservado / atendido / cancelado` |
| `usuarios` | usuario, password, nombre, rol, profesional (ref), activo, expiraEl, ultimoAcceso | usuario único, contraseña de 6 caracteres o más, rol válido, profesional obligatorio si el rol es profesional |
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

\* Con control por contexto: el profesional solo ve **sus** turnos y solo puede marcarlos como **atendidos**.

La matriz está definida en un único lugar, [`src/config/roles.js`](src/config/roles.js). Cada ruta declara el permiso exacto que necesita, por ejemplo:

```js
router.delete("/:id", requierePermiso("clientes:delete"), eliminarCliente);
```

### Buenas prácticas aplicadas

| Práctica | Cómo se implementa |
|---|---|
| **Mínimo privilegio** | Un usuario nuevo nace con el rol más bajo (`profesional`). Cada endpoint pide un permiso CRUD puntual y no un rol genérico. Los controladores solo aceptan los campos permitidos (`tomarCampos`), así nadie puede cambiar, por ejemplo, el `estado` de un turno al crearlo. La contraseña nunca viaja en las respuestas (`select: false` y `toJSON`). |
| **Roles jerárquicos** | En `roles.js`, cada rol hereda los permisos del anterior (`recepcion = [...profesional, ...]` y `admin = [...recepcion, ...]`). |
| **Control por contexto** | Un usuario con rol profesional solo lista y consulta los turnos que tiene asignados, y solo puede pasarlos a `atendido`. Un admin no puede desactivarse, cambiarse el rol, ponerse vencimiento ni eliminarse a sí mismo. |
| **Auditoría** | Se registran LOGIN, LOGIN_FALLIDO, LOGOUT, CREAR, MODIFICAR, ELIMINAR, CAMBIO_ESTADO, ACCESO_DENEGADO y SESION_REVOCADA, con usuario, entidad, detalle, IP y fecha. El admin los consulta en `/auditoria`. |
| **Revocación automática** | Hay tres mecanismos. (1) La sesión expira tras `SESSION_MINUTOS` de inactividad (`rolling`). (2) En cada request se vuelve a leer el usuario desde Mongo: si fue desactivado, eliminado o pasó su fecha `expiraEl`, la sesión se destruye en ese momento y se audita como SESION_REVOCADA. (3) Un usuario vencido o inactivo no puede volver a iniciar sesión. |
| **Fechas de creación, acceso y modificación** | `createdAt` y `updatedAt` vienen de `timestamps`. `ultimoAcceso` se actualiza en cada login sin modificar `updatedAt`, para no mezclar "accedió" con "lo modificaron". |

---

## API REST

Todas las rutas (salvo el login) requieren sesión. Responden **401** sin sesión y **403** sin permiso.

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | público | Inicia sesión `{ usuario, password }` |
| POST | `/api/auth/logout` | sesión | Cierra la sesión |
| GET | `/api/auth/yo` | sesión | Usuario actual y sus permisos |
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

---

## Declaración de uso de IA

En esta entrega usamos **Claude Code** como asistente de programación para:

- proponer un plan de trabajo acotado al alcance pedido.
- generar correcciones del código de la migración a MongoDB/Mongoose, del sistema de usuarios, roles, permisos y auditoría, y del front.
- redactar este README.

El grupo revisó, probó y ajustó todo el código generado. Las decisiones de diseño (roles, permisos CRUD, alcance del MVP) fueron nuestras.

---

## Bibliografía

- Documentación de Mongoose: https://mongoosejs.com/docs/
- Documentación de express-session: https://github.com/expressjs/session
- Express 5, manejo de errores: https://expressjs.com/en/guide/error-handling.html
- MDN, Fetch API: https://developer.mozilla.org/es/docs/Web/API/Fetch_API
- MongoDB Manual: https://www.mongodb.com/docs/manual/
