const express = require("express");
const router = express.Router();

const {
  obtenerClientes,
  obtenerClientePorId,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
} = require("../controllers/clientesController");

// Endpoints CRUD
router.get("/", obtenerClientes);
router.get("/:id", obtenerClientePorId);
router.post("/", crearCliente);
router.put("/:id", actualizarCliente);
router.delete("/:id", eliminarCliente);

// Ruta para eliminación desde formulario HTML (Vista Pug)
router.post("/:id/eliminar", eliminarCliente);

// Formulario HTML Pug (Modal)
router.post("/:id/editar", actualizarCliente);

module.exports = router;
