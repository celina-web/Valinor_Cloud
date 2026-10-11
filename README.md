# TurnoFlex — Sistema de Gestión de Turnos

Aplicación web backend desarrollada con **Node.js** y **Express** para gestionar los
turnos de un centro de atención. Permite administrar profesionales, clientes y turnos,
aplicando reglas de negocio.

Los datos se persisten en archivos **JSON** dentro de `src/data/` (un archivo por "tabla":
`clientes.json`, `profesionales.json`, `turnos.json`), sin base de datos externa.


---

## Requisitos

- Node.js 18 o superior
- npm

## Instalación y uso

```bash
npm install          # instala dependencias
npm run start          # inicia el servidor con nodemon (recarga automática)
# o bien
npm start            # inicia el servidor con node
```

El servidor queda disponible en **http://localhost:3000**.

- Interfaz web (HTML con Pug): `http://localhost:3000/`

## Estructura del proyecto

```
Valinor_Cloud/

├── public/
│   └── estilos.css              # Archivos estáticos (CSS de las vistas)
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
