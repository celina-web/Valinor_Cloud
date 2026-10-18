const express = require("express");
const { requiereLogin } = require("../../middlewares/auth");
const { obtenerMiPerfil, actualizarMiPerfil } = require("../../controllers/clientesController");

const router = express.Router();

router.use(requiereLogin, (req, res, next) => {
  if (req.usuario.rol !== "cliente" || !req.usuario.cliente) {
    return res.status(403).json({ error: "Esta sección es solo para clientes" });
  }
  next();
});

router.get("/perfil", obtenerMiPerfil);
router.put("/perfil", actualizarMiPerfil);

module.exports = router;
