const express = require('express');
const app = express();
const path = require('path');
const PORT = 3100;

const clientesRoutes = require('./routes/clientesRoutes');
const profesionalesRoutes = require('./routes/profesionalesRoutes');
const turnosRoutes = require('./routes/turnosRoutes');

app.use(express.json());

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use('/clientes', clientesRoutes);
app.use('/profesionales', profesionalesRoutes);
app.use('/turnos', turnosRoutes);

app.get('/', (req, res) => {
  res.status(200).render('base');
});

// Middleware para manejar rutas inexistentes
const rutaInexistente = (request, response) => {
    response.status(404).send({ error: 'Ruta inexistente' })
}
app.use(rutaInexistente)

app.listen(PORT, () => {
  console.log(`El servidor de node corriendo en http://localhost:${PORT}`);
});