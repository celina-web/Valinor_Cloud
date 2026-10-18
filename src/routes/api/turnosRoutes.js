const express = require("express");
const { requiereLogin, requierePermiso } = require("../../middlewares/auth");
const {
  obtenerTurnos,
  obtenerTurnoPorId,
  crearTurno,
  cambiarEstadoTurno,
  eliminarTurno,
} = require("../../controllers/turnosController");

const router = express.Router();

router.use(requiereLogin);

router.get("/", requierePermiso("turnos:read"), obtenerTurnos);
router.get("/:id", requierePermiso("turnos:read"), obtenerTurnoPorId);
router.post("/", requierePermiso("turnos:create"), crearTurno);
router.patch("/:id/estado", requierePermiso("turnos:update"), cambiarEstadoTurno);
router.delete("/:id", requierePermiso("turnos:delete"), eliminarTurno);

module.exports = router;
