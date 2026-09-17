const express = require('express');
const router = express.Router();

const {
    obtenerProfesionales,
    obtenerProfesionalPorId,
    crearProfesional,
    actualizarProfesional,
    eliminarProfesional
} = require('../controllers/profesionalesController');

// Rutas CRUD
router.get('/', obtenerProfesionales);
router.get('/:id', obtenerProfesionalPorId);
router.post('/', crearProfesional);
router.put('/:id', actualizarProfesional);
router.delete('/:id', eliminarProfesional);

module.exports = router;