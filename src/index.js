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
  res.send('Bienvenido a la turnera de TurnoFlex');
});

app.listen(PORT, () => {
  console.log(`El servidor de node corriendo en http://localhost:${PORT}`);
});