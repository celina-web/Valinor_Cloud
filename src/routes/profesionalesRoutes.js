const express = require("express");
const router = express.Router();

const {
  obtenerProfesionales,
  obtenerProfesionalPorId,
  crearProfesional,
  actualizarProfesional,
  eliminarProfesional,
} = require("../controllers/profesionalesController");

// Endpoints CRUD
router.get("/", obtenerProfesionales);
router.get("/:id", obtenerProfesionalPorId);
router.post("/", crearProfesional);
router.put("/:id", actualizarProfesional);
router.delete("/:id", eliminarProfesional);

// Ruta para eliminación desde formulario HTML (Vista Pug)
router.post("/:id/eliminar", eliminarProfesional);

// Formulario HTML Pug (Modal)
router.post("/:id/editar", actualizarProfesional);

module.exports = router;
