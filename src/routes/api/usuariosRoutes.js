const express = require("express");
const { requiereLogin, requierePermiso } = require("../../middlewares/auth");
const {
  obtenerUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
} = require("../../controllers/usuariosController");

const router = express.Router();

router.use(requiereLogin);

router.get("/", requierePermiso("usuarios:read"), obtenerUsuarios);
router.post("/", requierePermiso("usuarios:create"), crearUsuario);
router.put("/:id", requierePermiso("usuarios:update"), actualizarUsuario);
router.delete("/:id", requierePermiso("usuarios:delete"), eliminarUsuario);

module.exports = router;
