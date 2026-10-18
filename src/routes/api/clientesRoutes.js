const express = require("express");
const { requiereLogin, requierePermiso } = require("../../middlewares/auth");
const {
  obtenerClientes,
  obtenerClientePorId,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
} = require("../../controllers/clientesController");

const router = express.Router();

router.use(requiereLogin);

router.get("/", requierePermiso("clientes:read"), obtenerClientes);
router.get("/:id", requierePermiso("clientes:read"), obtenerClientePorId);
router.post("/", requierePermiso("clientes:create"), crearCliente);
router.put("/:id", requierePermiso("clientes:update"), actualizarCliente);
router.delete("/:id", requierePermiso("clientes:delete"), eliminarCliente);

module.exports = router;
