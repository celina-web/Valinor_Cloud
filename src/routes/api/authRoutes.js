const express = require("express");
const { requiereLogin } = require("../../middlewares/auth");
const {
  login,
  verificarRegistroCliente,
  registrarCliente,
  logout,
  usuarioActual,
} = require("../../controllers/authController");

const router = express.Router();

router.post("/login", login);
router.post("/registro-cliente/verificar", verificarRegistroCliente);
router.post("/registro-cliente", registrarCliente);
router.post("/logout", requiereLogin, logout);
router.get("/yo", requiereLogin, usuarioActual);

module.exports = router;
