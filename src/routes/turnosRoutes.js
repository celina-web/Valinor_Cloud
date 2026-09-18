const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/turnosController');
const { validarTurno } = require('../middlewares/validaciones');

router.get('/', ctrl.obtenerTurnos);
router.get('/:id', ctrl.obtenerTurnoPorId);
router.post('/', validarTurno, ctrl.crearTurno);
router.put('/:id', ctrl.actualizarTurno);
router.patch('/:id/estado', ctrl.cambiarEstadoTurno);
router.delete('/:id', ctrl.eliminarTurno);

module.exports = router;