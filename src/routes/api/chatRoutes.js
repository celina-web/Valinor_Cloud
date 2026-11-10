const express = require("express");
const { requiereLogin, requierePermiso } = require("../../middlewares/auth");
const {
  listarChats,
  obtenerChat,
  iniciarChat,
  aceptarChat,
  rechazarChat,
  finalizarChat,
  enviarMensaje,
} = require("../../controllers/chatController");

const router = express.Router();

router.use(requiereLogin);

router.get("/", requierePermiso("chat:usar"), listarChats);
router.get("/:id", requierePermiso("chat:usar"), obtenerChat);
// Que un admin no pueda iniciar se controla por contexto en el servicio (403).
router.post("/", requierePermiso("chat:usar"), iniciarChat);
router.post("/:id/aceptar", requierePermiso("chat:moderar"), aceptarChat);
router.post("/:id/rechazar", requierePermiso("chat:moderar"), rechazarChat);
router.post("/:id/finalizar", requierePermiso("chat:moderar"), finalizarChat);
router.post("/:id/mensajes", requierePermiso("chat:usar"), enviarMensaje);

module.exports = router;
