const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3100;

// Routers de la API REST
const clientesRoutes = require('./routes/clientesRoutes');
const profesionalesRoutes = require('./routes/profesionalesRoutes');
const turnosRoutes = require('./routes/turnosRoutes');
// Router de las vistas con Pug
const vistasRoutes = require('./routes/vistasRoutes');
// Middlewares propios
const logger = require('./middlewares/logger');
const { notFound, errorHandler } = require('./middlewares/errores');

// ----- Middlewares globales -----
app.use(logger); // registra cada petición
app.use(express.json()); // parsea body JSON
app.use(express.urlencoded({ extended: true })); // parsea formularios
app.use(express.static(path.join(__dirname, '../public'))); // archivos estáticos

// ----- Motor de plantillas -----
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// ----- API REST (JSON) -----
app.use('/api/clientes', clientesRoutes);
app.use('/api/profesionales', profesionalesRoutes);
app.use('/api/turnos', turnosRoutes);

// ----- Vistas (HTML) -----
app.use('/', vistasRoutes);

// ----- Manejo de errores -----
app.use(notFound); // 404 para rutas inexistentes
app.use(errorHandler); // 500 para errores no controlados

app.listen(PORT, () => {
  console.log(`El servidor de node corriendo en http://localhost:${PORT}`);
});
