const express = require('express');
const router = express.Router();
const vistas = require('../controllers/vistasController');

// Rutas que renderizan páginas HTML con Pug
router.get('/', vistas.home);
router.get('/clientes', vistas.listaClientes);
router.get('/profesionales', vistas.listaProfesionales);
router.get('/turnos', vistas.listaTurnos);

module.exports = router;
