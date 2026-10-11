const express = require('express');
const path = require('path');
const PORT = process.env.PORT || 3000;

// Routers de la API REST
const clientesRoutes = require('./routes/clientesRoutes');
const profesionalesRoutes = require('./routes/profesionalesRoutes');
const turnosRoutes = require('./routes/turnosRoutes');
// Router de las vistas con Pug
const vistasRoutes = require('./routes/vistasRoutes');
// Middlewares propios
const logger = require('./middlewares/logger');
const { notFound, errorHandler } = require('./middlewares/errores');

app.use(express.json());
// Middleware para leer datos de formularios
app.use(express.urlencoded({ extended: true }));

// Configura el motor de plantillas Pug
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Permite servir archivos estáticos desde la carpeta "public" (CSS en nuestro caso)
app.use(express.static(path.join(__dirname, 'public')));

// Rutas
app.use('/clientes', clientesRoutes);
app.use('/profesionales', profesionalesRoutes);
app.use('/turnos', turnosRoutes);

app.get("/", (req, res) => {
  if (req.accepts("html")) {
    return res.render("home");
  }
  res.json({ mensaje: "Bienvenido al sistema TurnoFlex" });
});

// ----- Manejo de errores -----
app.use(notFound); // 404 para rutas inexistentes
app.use(errorHandler); // 500 para errores no controlados

app.listen(PORT, () => {
  console.log(`El servidor de node corriendo en http://localhost:${PORT}`);
});
