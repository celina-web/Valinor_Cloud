# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Descripción

TurnoFlex: aplicación web de gestión de turnos (Node.js 18+, Express 5, MongoDB/Mongoose 8, vistas Pug, CommonJS). Todo el código, mensajes, README y comentarios están en español rioplatense; mantené ese idioma.

## Comandos

```bash
npm install
cp .env.example .env     # variables: PORT, MONGO_URI, SESSION_SECRET, SESSION_MINUTOS
npm run seed             # BORRA la base y crea datos y usuarios de prueba (admin/admin123, etc.)
npm run dev              # nodemon src/index.js
npm start                # node src/index.js
```

Con Docker (modo desarrollo, hot-reload con nodemon sobre `./src` montado como volumen; guía en `docs/Docker/docker-readme.md`):

```bash
docker compose up --build            # app + mongo; Compose sobrescribe MONGO_URI a mongodb://mongo:27017/turnoflex
docker compose exec app npm run seed
docker compose down -v               # detiene y borra los datos (volumen mongo_data)
```

Sin Docker requiere una instancia de MongoDB corriendo (por defecto `mongodb://127.0.0.1:27017/turnoflex`). No hay tests ni linter configurados. La colección de Postman está en `docs/TurnoFlex.postman_collection.json`.

## Arquitectura

- **Vistas y API separadas.** `src/routes/vistasRoutes.js` solo renderiza el esqueleto de cada página con Pug; los datos los carga el JS del navegador (`src/public/js/*.js`, usando `api.js` como wrapper de `fetch`) contra `/api/...`, que siempre responde JSON.
- **Cadena de middlewares por ruta:** `requiereLogin` → `requierePermiso("recurso:accion")` → controlador (`src/middlewares/auth.js`). `requiereLogin` vuelve a leer el usuario desde Mongo en cada request: si está desactivado, eliminado o vencido (`expiraEl`), destruye la sesión y audita `SESION_REVOCADA`. Distingue API de vistas por el prefijo `/api` (401 JSON vs. redirect a `/login`).
- **Permisos:** la matriz CRUD vive solo en `src/config/roles.js`. Los roles son jerárquicos por spread de arrays (`profesional` ⊂ `recepcion` ⊂ `admin`). Para agregar un permiso, definilo ahí y usalo en la ruta.
- **Control por contexto** (en controladores, no en roles): el rol `profesional` solo ve sus propios turnos y solo puede pasarlos a `atendido`; un admin no puede desactivarse, cambiarse el rol, ponerse vencimiento ni eliminarse a sí mismo.
- **Errores:** Express 5 propaga errores de controladores `async` al `errorHandler` (`src/middlewares/errores.js`), que traduce errores de Mongoose (validación → 400, id inválido → 400, duplicado → 409). No hace falta `try/catch` en los controladores.
- **Auditoría:** `registrarAuditoria(req, accion, {...})` en `src/helpers/auditoria.js`; la acción debe estar en la lista permitida del modelo `Auditoria`. Se llama en login/logout, altas/bajas/modificaciones, cambios de estado y accesos denegados.
- **Mass assignment:** los controladores filtran el body con `tomarCampos()` (`src/helpers/campos.js`); usalo en todo endpoint nuevo de escritura.
- **Contraseñas:** campo `select: false` en `Usuario` y excluido en `toJSON`; no devolverlas nunca en respuestas.

## Reglas de negocio de turnos

- Sin doble reserva (mismo profesional o mismo cliente en misma fecha y hora) → 409.
- Estados: `reservado` → `atendido` | `cancelado`; ambos son finales.
- Solo se eliminan turnos `cancelado`.
- No se puede eliminar un cliente o profesional con turnos reservados (409), ni un profesional con usuario vinculado.
- Formatos: fecha `YYYY-MM-DD`, hora `HH:mm`, DNI de 7 u 8 dígitos.
