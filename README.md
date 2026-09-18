# TurnoFlex — Sistema de Gestión de Turnos

Aplicación web backend desarrollada con **Node.js** y **Express** para gestionar los
turnos de un centro de atención. Permite administrar profesionales, clientes y turnos,
aplicando reglas de negocio.

Los datos se persisten en archivos **JSON** dentro de `data/` (un archivo por "tabla":
`clientes.json`, `profesionales.json`, `turnos.json`), sin base de datos externa.

---

## Índice

- [Requisitos](#requisitos)
- [Instalación y uso](#instalación-y-uso)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Arquitectura](#arquitectura)
- [Reglas de negocio](#reglas-de-negocio)
- [Endpoints de la API](#endpoints-de-la-api)
- [Vistas (Pug)](#vistas-pug)
- [Pruebas con Postman](#pruebas-con-postman)
- [Roles y responsabilidades](#roles-y-responsabilidades)
- [Bibliografía](#bibliografía)

---

## Requisitos

- Node.js 18 o superior
- npm

## Instalación y uso

```bash
npm install          # instala dependencias
npm run dev          # inicia el servidor con nodemon (recarga automática)
# o bien
npm start            # inicia el servidor con node
```

El servidor queda disponible en **http://localhost:3100**.

- Interfaz web (HTML con Pug): `http://localhost:3100/`
- API REST (JSON): `http://localhost:3100/api/...`

## Estructura del proyecto

```
Valinor_Cloud/

├── public/
│   └── estilos.css              # Archivos estáticos (CSS de las vistas)
├── docs/
│   └── TurnoFlex.postman_collection.json   # Colección para importar en Postman
├── src/
│   ├── index.js                 # Punto de entrada: configura Express y middlewares
│   └── data/                    # "Base de datos": un archivo JSON por tabla
│       ├── clientes.json
│       ├── profesionales.json
│       └── turnos.json
│   ├── models/                  # Clases POO: Cliente, Profesional, Turno
│   ├── controllers/             # Lógica de cada recurso + vistas
│   ├── routes/                  # Definición de rutas (API y vistas)
│   └── views/                   # Plantillas Pug (layout + páginas)
├── package.json
└── README.md
```

## Arquitectura

El proyecto sigue el patrón **MVC** y separa dos capas:

- **API REST** bajo `/api/*` → devuelve **JSON**.
- **Vistas** bajo `/*` → devuelve **HTML** renderizado con el motor de plantillas **Pug**.

Conceptos aplicados (según los módulos de la materia):

- **Rutas dinámicas** con parámetros (`/api/clientes/:id`).
- **POO**: las clases `Cliente`, `Profesional` y `Turno` modelan los datos e incluyen
  métodos (`nombreCompleto()`, `static validar()`).
- **Motor de plantillas Pug** con herencia de plantillas (`extends` / `block`).

## Reglas de negocio

- Un profesional no puede tener dos turnos en el mismo horario. → `409`
- Un cliente no puede tener dos turnos en el mismo horario. → `409`
- Un turno puede estar en estado `reservado`, `cancelado` o `atendido`.
- Transiciones válidas: `reservado → atendido` o `reservado → cancelado`.
  Los estados `atendido` y `cancelado` son finales.
- No se puede modificar un turno cancelado. → `409`
- Solo se pueden eliminar turnos que estén en estado `cancelado`. → `409`

## Endpoints de la API

Base URL: `http://localhost:3100`

### Clientes — `/api/clientes`

| Método | Ruta                 | Descripción                | Body (JSON)                                 | Respuestas |
|--------|----------------------|----------------------------|---------------------------------------------|------------|
| GET    | `/api/clientes`      | Lista todos los clientes   | —                                           | 200 |
| GET    | `/api/clientes/:id`  | Obtiene un cliente por id  | —                                           | 200 / 404 |
| POST   | `/api/clientes`      | Crea un cliente            | `nombre`, `apellido`, `dni` (obligatorios)  | 201 / 400 |
| PUT    | `/api/clientes/:id`  | Actualiza un cliente       | campos a modificar                          | 200 / 400 / 404 |
| DELETE | `/api/clientes/:id`  | Elimina un cliente         | —                                           | 200 / 404 |

### Profesionales — `/api/profesionales`

| Método | Ruta                      | Descripción                    | Body (JSON)                                | Respuestas |
|--------|---------------------------|--------------------------------|--------------------------------------------|------------|
| GET    | `/api/profesionales`      | Lista todos los profesionales  | —                                          | 200 |
| GET    | `/api/profesionales/:id`  | Obtiene un profesional por id  | —                                          | 200 / 404 |
| POST   | `/api/profesionales`      | Crea un profesional            | `nombre`, `apellido`, `dni` (obligatorios) | 201 / 400 |
| PUT    | `/api/profesionales/:id`  | Actualiza un profesional       | campos a modificar                         | 200 / 400 / 404 |
| DELETE | `/api/profesionales/:id`  | Elimina un profesional         | —                                          | 200 / 404 |

### Turnos — `/api/turnos`

| Método | Ruta                        | Descripción                    | Body (JSON)                                             | Respuestas |
|--------|-----------------------------|--------------------------------|--------------------------------------------------------|------------|
| GET    | `/api/turnos`               | Lista todos los turnos         | —                                                      | 200 |
| GET    | `/api/turnos/:id`           | Obtiene un turno por id        | —                                                      | 200 / 404 |
| POST   | `/api/turnos`               | Crea un turno (estado reservado) | `idCliente`, `idProfesional`, `fecha`, `hora`, `precio?` | 201 / 400 / 404 / 409 |
| PUT    | `/api/turnos/:id`           | Actualiza fecha/hora/precio    | `fecha?`, `hora?`, `precio?`                            | 200 / 404 / 409 |
| PATCH  | `/api/turnos/:id/estado`    | Cambia el estado del turno     | `estado` (`atendido` / `cancelado`)                    | 200 / 400 / 404 / 409 |
| DELETE | `/api/turnos/:id`           | Elimina un turno cancelado     | —                                                      | 200 / 404 / 409 |

## Vistas (Pug)

| Ruta             | Descripción                                             |
|------------------|--------------------------------------------------------|
| `/`              | Página de inicio con el menú de navegación             |
| `/clientes`      | Tabla con el listado de clientes                        |
| `/profesionales` | Tabla con el listado de profesionales                   |
| `/turnos`        | Tabla de turnos (muestra nombre de cliente y profesional) |

Todas las vistas heredan de `layout.pug` mediante `extends` / `block contenido`.

## Pruebas con Postman

1. Levantar el servidor: `npm run dev`.
2. En Postman: **Import** → seleccionar `docs/TurnoFlex.postman_collection.json`.
3. La colección trae la variable `base_url` (`http://localhost:3100`) y las carpetas
   **Clientes**, **Profesionales** y **Turnos** con todos los requests listos, incluyendo
   casos de error (validación → 400, turno superpuesto → 409, ruta inexistente → 404).
4. Ejecutar los requests y capturar la evidencia de al menos una prueba.

> La captura de evidencia y el informe del trabajo se entregan en un documento aparte.

## Roles y responsabilidades

> Completar con los datos reales del equipo.

| Integrante   | Rol                         | Responsabilidades                                      |
|--------------|-----------------------------|--------------------------------------------------------|
| Integrante 1 | _(ej. Backend / API)_       | _(ej. controllers y rutas de clientes/profesionales)_  |
| Integrante 2 | _(ej. Lógica de negocio)_   | _(ej. turnos: reglas, estados y validaciones)_         |
| Integrante 3 | _(ej. Vistas / Frontend)_   | _(ej. plantillas Pug, estilos y navegación)_           |
| Integrante 4 | _(ej. Documentación / QA)_  | _(ej. README, pruebas con Postman y evidencias)_       |

## Bibliografía

- Módulos de la materia **Desarrollo de Sistemas Web (Back End)**:
  - D2. Introducción a JavaScript
  - D3. Asincronismo Web
  - D4. POO con JavaScript
  - D5. Fundamentos de Node.js
  - D6. Introducción a Express
  - D7. API REST básica con Node y Express
  - Mapa de Contenidos: Bloque 1, 2, 3 y 4
- Documentación oficial de [Express](https://expressjs.com/es/)
- Documentación oficial de [Pug](https://pugjs.org/)
- Documentación oficial de [Node.js](https://nodejs.org/es/docs)
- Documentación de [Postman](https://learning.postman.com/docs/)