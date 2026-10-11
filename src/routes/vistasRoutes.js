const express = require("express");
const { requiereLogin, requierePermiso } = require("../middlewares/auth");
const {
  mostrarLogin,
  mostrarPanel,
  mostrarClientes,
  mostrarProfesionales,
  mostrarTurnos,
  mostrarUsuarios,
  mostrarAuditoria,
} = require("../controllers/vistasController");

const router = express.Router();

router.get("/login", mostrarLogin);

router.use(requiereLogin);

router.get("/", mostrarPanel);
router.get("/clientes", requierePermiso("clientes:read"), mostrarClientes);
router.get("/profesionales", requierePermiso("profesionales:read"), mostrarProfesionales);
router.get("/turnos", requierePermiso("turnos:read"), mostrarTurnos);
router.get("/usuarios", requierePermiso("usuarios:read"), mostrarUsuarios);
router.get("/auditoria", requierePermiso("auditoria:read"), mostrarAuditoria);

module.exports = router;
