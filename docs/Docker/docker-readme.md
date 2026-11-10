# TurnoFlex con Docker (modo desarrollo)

Esta guía explica cómo levantar TurnoFlex con contenedores: uno para la aplicación (Node.js) y otro para MongoDB, conectados entre sí. El entorno está pensado para **desarrollo**: el código de `src/` se monta como volumen y **nodemon** reinicia la app automáticamente al guardar cambios.

## Requisitos

- Docker Engine y Docker Compose v2 (`docker compose version`).
- No hace falta tener Node.js ni MongoDB instalados en tu máquina.

## Arquitectura

```
Navegador ──► localhost:3000 ──► [contenedor app]  ──► mongo:27017 ──► [contenedor mongo]
                                   Node 22 + nodemon                      MongoDB 7
                                   ./src (bind mount)                     volumen mongo_data
```

- **app**: se construye con el `Dockerfile` de la raíz. Las dependencias viven en la imagen; `./src` se monta desde tu máquina.
- **mongo**: imagen oficial `mongo:7`. Los datos persisten en el volumen nombrado `mongo_data`. El puerto 27017 se publica solo en `127.0.0.1` para poder conectar Compass o `mongosh` desde tu equipo.
- La app espera a que Mongo esté saludable (`healthcheck`) antes de iniciar.
- Dentro de la red de Compose, la app se conecta con `MONGO_URI=mongodb://mongo:27017/turnoflex`. El `docker-compose.yml` sobrescribe este valor, por lo que el `127.0.0.1` del `.env` no afecta a los contenedores.

## Pasos para levantar la aplicación

1. Crear el archivo de entorno (desde la raíz del proyecto):

   ```bash
   cp .env.example .env
   ```

   Cambiá `JWT_SECRET` por un texto largo y aleatorio (si falta, la app usa una clave de desarrollo y muestra un aviso al iniciar).

2. Construir y levantar los contenedores:

   ```bash
   docker compose up --build
   ```

   Esperá a ver `MongoDB conectado: turnoflex` y `Servidor corriendo en http://localhost:3000`. Para dejarlo en segundo plano agregá `-d`.

3. Cargar los datos y usuarios de prueba (en otra terminal). **Borra todo lo que haya en la base**:

   ```bash
   docker compose exec app npm run seed
   ```

4. Abrir **http://localhost:3000** e ingresar con alguno de los usuarios de prueba (ver el [README principal](../../README.md#usuarios-de-prueba-creados-por-npm-run-seed)), por ejemplo `admin` / `admin123`.

## Flujo de desarrollo

- Editá cualquier archivo de `src/` (JS, vistas Pug, CSS) en tu máquina: nodemon reinicia el servidor y lo vas a ver en los logs (`docker compose logs -f app`). No hace falta reconstruir la imagen.
- Si cambiás `package.json` (agregar o actualizar dependencias), reconstruí:

  ```bash
  docker compose up --build
  ```

  Si el contenedor ya tiene `node_modules` viejo en el volumen anónimo, usá `docker compose up --build --renew-anon-volumes`.
- Para instalar un paquete: `docker compose exec app npm install <paquete>` y luego reconstruir como arriba, para que quede en la imagen.

## Comandos útiles

| Acción | Comando |
|---|---|
| Ver estado | `docker compose ps` |
| Ver logs de la app | `docker compose logs -f app` |
| Detener (conserva datos) | `docker compose down` |
| Detener y **borrar datos** | `docker compose down -v` |
| Shell de MongoDB | `docker compose exec mongo mongosh turnoflex` |
| Shell en la app | `docker compose exec app sh` |
| Reiniciar solo la app | `docker compose restart app` |

## Variables de entorno

Se toman del `.env`, con estas particularidades:

| Variable | Comportamiento con Docker |
|---|---|
| `PORT` | Define el puerto publicado en tu equipo (`${PORT}:3000`). Dentro del contenedor la app siempre escucha en 3000. |
| `MONGO_URI` | Sobrescrita por Compose (`mongodb://mongo:27017/turnoflex`). |
| `JWT_SECRET`, `JWT_MINUTOS` | Se leen del `.env` sin cambios. |
| `CHAT_MAX_POR_ADMIN`, `CHAT_TIMEOUT_MINUTOS` | Opcionales; se leen del `.env` sin cambios (chat de consultas). |

## Problemas frecuentes

- **La app sale con "No se pudo iniciar el servidor"**: Mongo no estaba listo o `MONGO_URI` apunta a `127.0.0.1`. Revisá `docker compose logs mongo` y que no hayas quitado la sobrescritura en `docker-compose.yml`.
- **Los cambios no se reflejan**: confirmá que editás archivos dentro de `src/` y que el comando sigue usando `nodemon -L` (polling).
- **Puerto 3000 o 27017 ocupado**: cambiá `PORT` en el `.env`, o detené el MongoDB local (`sudo systemctl stop mongod`).
- **Permisos en Linux**: el contenedor corre como el usuario `node` (UID 1000). Si tu usuario tiene otro UID y la app no puede leer `src/`, revisá los permisos de la carpeta.
- **`Cannot find module 'passport'` o `'socket.io'` (u otra dependencia nueva)**: el volumen anónimo de `node_modules` conserva las dependencias viejas. Reconstruí renovándolo: `docker compose up --build -V`.
- **No puedo iniciar sesión con los usuarios de prueba después de actualizar**: las contraseñas ahora se guardan hasheadas. Volvé a cargar los datos con `docker compose exec app npm run seed`.
- **Empezar de cero**: `docker compose down -v --rmi local` y repetir los pasos.
