const express = require('express');
const app = express();
const PORT = 3100;

const clientesRoutes = require('./routes/clientesRoutes');
const profesionalesRoutes = require('./routes/profesionalesRoutes');
const turnosRoutes = require('./routes/turnosRoutes');

app.use(express.json());

app.use('/clientes', clientesRoutes);
app.use('/profesionales', profesionalesRoutes);
app.use('/turnos', turnosRoutes);

app.get('/', (req, res) => {
  res.send('Centro de Atención de TurnoFlex' + '\n\n' +
    '/clientes - Rutas para clientes' + '\n' +
    '/profesionales - Rutas para profesionales' + '\n' +
    '/turnos - Rutas para turnos'
  );
});

// Middleware para manejar rutas inexistentes
const rutaInexistente = (request, response) => {
    response.status(404).send({ error: 'Ruta inexistente' })
}
app.use(rutaInexistente)

app.listen(PORT, () => {
  console.log(`El servidor de node corriendo en http://localhost:${PORT}`);
});