const express = require("express");
const { requiereLogin, requierePermiso } = require("../../middlewares/auth");
const { obtenerAuditoria } = require("../../controllers/auditoriaController");

const router = express.Router();

router.use(requiereLogin);

router.get("/", requierePermiso("auditoria:read"), obtenerAuditoria);

module.exports = router;
