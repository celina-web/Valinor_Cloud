const express = require('express');
const router = express.Router();

const {
    obtenerProfesionales,
    obtenerProfesionalPorId,
    crearProfesional,
    actualizarProfesional,
    eliminarProfesional
} = require('../controllers/profesionalesController');

const { validarProfesional } = require('../middlewares/validaciones');

router.get('/', obtenerProfesionales);
router.get('/:id', obtenerProfesionalPorId);
router.post('/', validarProfesional, crearProfesional);
router.put('/:id', validarProfesional, actualizarProfesional);
router.delete('/:id', eliminarProfesional);

module.exports = router;