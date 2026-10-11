const express = require("express");
const router = express.Router();

const {
  obtenerTurnos,
  obtenerTurnoPorId,
  crearTurno,
  cambiarEstadoTurno,
  eliminarTurno,
} = require("../controllers/turnosController");

// Endpoints
router.get("/", obtenerTurnos);
router.get("/:id", obtenerTurnoPorId);
router.post("/", crearTurno);
router.put("/:id/estado", cambiarEstadoTurno);
router.patch("/:id/estado", cambiarEstadoTurno);
router.post("/:id/estado", cambiarEstadoTurno); // Formulario HTML Pug
router.delete("/:id", eliminarTurno);

module.exports = router;
