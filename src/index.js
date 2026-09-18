const express = require('express');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 3000;

const clientesRoutes = require('./routes/clientesRoutes');
const profesionalesRoutes = require('./routes/profesionalesRoutes');
const turnosRoutes = require('./routes/turnosRoutes');

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

// Middleware para manejar rutas inexistentes
const rutaInexistente = (request, response) => {
    response.status(404).send({ error: 'Ruta inexistente' })
}
app.use(rutaInexistente)

app.listen(PORT, () => {
  console.log(`El servidor de node corriendo en http://localhost:${PORT}`);
});