const chatService = require("../services/chatService");
const { tomarCampos } = require("../helpers/campos");
const { CHAT_MAX_POR_ADMIN } = require("../config/chat");

// Admin: sus chats pendientes y activos. Recepción/profesional: su chat abierto o el último.
const listarChats = async (req, res) => {
  const chats = await chatService.listarChats(req.usuario);
  res.json({ chats, maxPorAdmin: CHAT_MAX_POR_ADMIN });
};

const obtenerChat = async (req, res) => {
  res.json(await chatService.obtenerChat(req.usuario, req.params.id));
};

const iniciarChat = async (req, res) => {
  const { mensaje } = tomarCampos(req.body, ["mensaje"]);
  const chat = await chatService.iniciarChat(req, mensaje);
  res.status(201).json(chat);
};

const aceptarChat = async (req, res) => {
  res.json(await chatService.aceptarChat(req, req.params.id));
};

const rechazarChat = async (req, res) => {
  res.json(await chatService.rechazarChat(req, req.params.id));
};

const finalizarChat = async (req, res) => {
  res.json(await chatService.finalizarChat(req, req.params.id));
};

const enviarMensaje = async (req, res) => {
  const { texto } = tomarCampos(req.body, ["texto"]);
  const mensaje = await chatService.enviarMensaje(req, req.params.id, texto);
  res.status(201).json(mensaje);
};

module.exports = {
  listarChats,
  obtenerChat,
  iniciarChat,
  aceptarChat,
  rechazarChat,
  finalizarChat,
  enviarMensaje,
};
