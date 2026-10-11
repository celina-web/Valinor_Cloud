const express = require("express");
const { requiereLogin, requierePermiso } = require("../../middlewares/auth");
const {
  obtenerProfesionales,
  obtenerProfesionalPorId,
  crearProfesional,
  actualizarProfesional,
  eliminarProfesional,
} = require("../../controllers/profesionalesController");

const router = express.Router();

router.use(requiereLogin);

router.get("/", requierePermiso("profesionales:read"), obtenerProfesionales);
router.get("/:id", requierePermiso("profesionales:read"), obtenerProfesionalPorId);
router.post("/", requierePermiso("profesionales:create"), crearProfesional);
router.put("/:id", requierePermiso("profesionales:update"), actualizarProfesional);
router.delete("/:id", requierePermiso("profesionales:delete"), eliminarProfesional);

module.exports = router;
