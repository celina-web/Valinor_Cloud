// Lógica de negocio del chat de consultas (máquina de estados, asignación de admins y timeouts).
// La usan los controladores REST, el servidor de Socket.io y los temporizadores.
//
// Cada transición es un findOneAndUpdate con el estado de origen en el filtro: si dos
// acciones compiten (por ejemplo "aceptar" y el timeout), solo una gana y la otra recibe 409.
const mongoose = require("mongoose");

const Chat = require("../models/Chat");
const { ABIERTOS, MAX_TEXTO } = require("../models/Chat");
const { CHAT_MAX_POR_ADMIN, CHAT_TIMEOUT_MS, GRACIA_DESCONEXION_MS, MENSAJE_SIN_OPERADORES } =
  require("../config/chat");
const { crearError } = require("../helpers/errores");
const { registrarAuditoria } = require("../helpers/auditoria");
const presencia = require("../socket/presencia");
const { emitirA } = require("../socket/emisor");
const timeouts = require("./chatTimeouts");

const { trusted } = mongoose;
const POBLAR = { path: "solicitante admin", select: "nombre usuario rol" };
const SISTEMA = { usuarioNombre: "sistema" };
// Pseudo-request para auditar acciones del servidor (timeouts, reasignaciones).
const REQ_SISTEMA = { ip: null };
const arranque = Date.now();
const VENTANA_ULTIMO_CERRADO_MS = 60 * 60 * 1000;

// Mutex en proceso: la elección de admin y la creación/reasignación de chats se
// ejecutan de a una, para que dos solicitudes simultáneas no superen el límite por admin.
let cola = Promise.resolve();
const encolar = (tarea) => {
  const resultado = cola.then(tarea);
  cola = resultado.catch(() => {});
  return resultado;
};

const idDe = (valor) => String(valor && valor._id ? valor._id : valor);
const participantes = (chat) => [idDe(chat.solicitante), idDe(chat.admin)];
const esParticipante = (chat, usuario) => participantes(chat).includes(String(usuario._id));

const validarTexto = (texto) => {
  if (typeof texto !== "string" || !texto.trim()) {
    throw crearError(400, "El mensaje no puede estar vacío");
  }
  const limpio = texto.trim();
  if (limpio.length > MAX_TEXTO) {
    throw crearError(400, `El mensaje no puede superar los ${MAX_TEXTO} caracteres`);
  }
  return limpio;
};

// Cantidad de chats abiertos (pendientes + activos) de cada admin.
const cargaDe = async (adminIds) => {
  const carga = new Map(adminIds.map((id) => [String(id), 0]));
  if (!adminIds.length) return carga;
  const filas = await Chat.aggregate([
    {
      $match: {
        admin: { $in: adminIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
        estado: { $in: ABIERTOS },
      },
    },
    { $group: { _id: "$admin", total: { $sum: 1 } } },
  ]);
  filas.forEach((fila) => carga.set(String(fila._id), fila.total));
  return carga;
};

// Admin conectado con menos chats abiertos y por debajo del límite (empate: al azar).
const elegirAdmin = async ({ excluir } = {}) => {
  const candidatos = presencia.adminsConectados().filter((id) => id !== String(excluir || ""));
  const carga = await cargaDe(candidatos);
  const disponibles = candidatos.filter((id) => carga.get(id) < CHAT_MAX_POR_ADMIN);
  if (!disponibles.length) return null;
  const minima = Math.min(...disponibles.map((id) => carga.get(id)));
  const menosCargados = disponibles.filter((id) => carga.get(id) === minima);
  return menosCargados[Math.floor(Math.random() * menosCargados.length)];
};

const programarTimeout = (chat) => timeouts.programar(chat._id, chat.expiraEl, expirar);

// Explica por qué una transición no se pudo aplicar (404 si no te corresponde verlo).
const errorDeTransicion = async (chatId, usuario) => {
  const chat = await Chat.findById(chatId).select("solicitante admin estado");
  if (!chat) return crearError(404, "Chat no encontrado");
  if (!esParticipante(chat, usuario)) {
    return usuario.rol === "admin"
      ? crearError(409, "La consulta está asignada a otro operador")
      : crearError(404, "Chat no encontrado");
  }
  const textos = {
    pendiente: "La consulta todavía no fue aceptada",
    activo: "La consulta ya fue aceptada",
    finalizado: "La conversación ya fue finalizada",
    rechazado: "La consulta fue rechazada",
  };
  return crearError(409, textos[chat.estado]);
};

const auditarCambio = (req, chat, detalle, datos = {}) =>
  registrarAuditoria(req, "CAMBIO_ESTADO", {
    ...datos,
    entidad: "Chat",
    entidadId: chat._id,
    detalle,
  });

// ---------- Consultas ----------

const listarChats = async (usuario) => {
  if (usuario.rol === "admin") {
    return Chat.find({ admin: usuario._id, estado: trusted({ $in: ABIERTOS }) })
      .sort({ createdAt: 1 })
      .populate(POBLAR);
  }
  // Solicitante: su chat abierto o, si no tiene, el último cerrado en la última hora
  // (para que vea cómo terminó sin arrastrar conversaciones viejas).
  const chat =
    (await Chat.findOne({ solicitante: usuario._id, estado: trusted({ $in: ABIERTOS }) }).populate(
      POBLAR
    )) ||
    (await Chat.findOne({
      solicitante: usuario._id,
      cerradoEl: trusted({ $gte: new Date(Date.now() - VENTANA_ULTIMO_CERRADO_MS) }),
    })
      .sort({ cerradoEl: -1 })
      .populate(POBLAR));
  return chat ? [chat] : [];
};

const obtenerChat = async (usuario, chatId) => {
  const chat = await Chat.findById(chatId).populate(POBLAR);
  if (!chat || !esParticipante(chat, usuario)) throw crearError(404, "Chat no encontrado");
  return chat;
};

// ---------- Transiciones ----------

const iniciarChat = async (req, texto) => {
  const usuario = req.usuario;
  if (usuario.rol === "admin") {
    throw crearError(403, "Los administradores no pueden iniciar conversaciones");
  }
  const contenido = validarTexto(texto);

  return encolar(async () => {
    if (await Chat.exists({ solicitante: usuario._id, estado: trusted({ $in: ABIERTOS }) })) {
      throw crearError(409, "Ya tenés una consulta abierta");
    }

    const adminId = await elegirAdmin();
    if (!adminId) {
      await registrarAuditoria(req, "CHAT_SIN_OPERADOR", {
        entidad: "Chat",
        detalle: "No había operadores disponibles para atender la consulta",
      });
      throw crearError(503, MENSAJE_SIN_OPERADORES);
    }

    const chat = await Chat.create({
      solicitante: usuario._id,
      rolSolicitante: usuario.rol,
      admin: adminId,
      expiraEl: new Date(Date.now() + CHAT_TIMEOUT_MS),
      mensajes: [{ autor: usuario._id, texto: contenido }],
    });
    programarTimeout(chat);
    await chat.populate(POBLAR);

    emitirA([adminId], "chat:nuevo", chat);
    emitirA([usuario._id], "chat:actualizado", chat);
    await registrarAuditoria(req, "CREAR", {
      entidad: "Chat",
      entidadId: chat._id,
      detalle: `Consulta asignada a ${chat.admin.usuario}`,
    });
    return chat;
  });
};

const aceptarChat = async (req, chatId) => {
  const chat = await Chat.findOneAndUpdate(
    { _id: chatId, estado: "pendiente", admin: req.usuario._id },
    { estado: "activo", aceptadoEl: new Date() },
    { new: true }
  ).populate(POBLAR);
  if (!chat) throw await errorDeTransicion(chatId, req.usuario);

  timeouts.cancelar(chat._id);
  emitirA(participantes(chat), "chat:actualizado", chat);
  await auditarCambio(req, chat, "pendiente → activo");
  return chat;
};

const rechazarChat = async (req, chatId) => {
  const chat = await Chat.findOneAndUpdate(
    { _id: chatId, estado: "pendiente", admin: req.usuario._id },
    { estado: "rechazado", motivoCierre: "rechazo", cerradoEl: new Date() },
    { new: true }
  ).populate(POBLAR);
  if (!chat) throw await errorDeTransicion(chatId, req.usuario);

  timeouts.cancelar(chat._id);
  emitirA(participantes(chat), "chat:actualizado", chat);
  await auditarCambio(req, chat, "pendiente → rechazado");
  return chat;
};

const finalizarChat = async (req, chatId) => {
  const chat = await Chat.findOneAndUpdate(
    { _id: chatId, estado: "activo", admin: req.usuario._id },
    { estado: "finalizado", motivoCierre: "admin", cerradoEl: new Date() },
    { new: true }
  ).populate(POBLAR);
  if (!chat) throw await errorDeTransicion(chatId, req.usuario);

  emitirA(participantes(chat), "chat:finalizado", {
    chatId: String(chat._id),
    estado: chat.estado,
    motivo: chat.motivoCierre,
    cerradoEl: chat.cerradoEl,
  });
  await auditarCambio(req, chat, "activo → finalizado (por el operador)");
  return chat;
};

const enviarMensaje = async (req, chatId, texto) => {
  const contenido = validarTexto(texto);
  const yo = req.usuario._id;
  const mensaje = {
    _id: new mongoose.Types.ObjectId(),
    autor: yo,
    texto: contenido,
    createdAt: new Date(),
  };

  const chat = await Chat.findOneAndUpdate(
    { _id: chatId, estado: "activo", $or: [{ solicitante: yo }, { admin: yo }] },
    { $push: { mensajes: mensaje } },
    { new: true, projection: { solicitante: 1, admin: 1 } }
  );
  if (!chat) throw await errorDeTransicion(chatId, req.usuario);

  const datos = { chatId: String(chat._id), mensaje: { ...mensaje, autor: String(yo) } };
  // También al emisor: así se sincronizan sus otras pestañas.
  emitirA(participantes(chat), "chat:mensaje", datos);
  return datos.mensaje;
};

// La llama el temporizador: nadie aceptó la consulta a tiempo.
const expirar = async (chatId) => {
  try {
    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, estado: "pendiente" },
      { estado: "finalizado", motivoCierre: "timeout", cerradoEl: new Date() },
      { new: true }
    );
    if (!chat) return;

    emitirA(participantes(chat), "chat:finalizado", {
      chatId: String(chat._id),
      estado: chat.estado,
      motivo: chat.motivoCierre,
      cerradoEl: chat.cerradoEl,
    });
    await auditarCambio(REQ_SISTEMA, chat, "pendiente → finalizado (timeout)", SISTEMA);
  } catch (error) {
    console.error("No se pudo expirar el chat:", error.message);
  }
};

// Al arrancar: reconstruye los temporizadores de los chats pendientes (los vencidos se expiran ya).
const recuperarTimeouts = async () => {
  const pendientes = await Chat.find({ estado: "pendiente" }).select("expiraEl");
  pendientes.forEach(programarTimeout);
  if (pendientes.length) {
    console.log(`Chat: ${pendientes.length} consulta(s) pendiente(s) con timeout reprogramado.`);
  }
};

// ---------- Reasignación ----------

// Cambia el admin de un chat pendiente y avisa a los dos admins involucrados.
const reasignar = async (chat, adminNuevo) => {
  const actualizado = await Chat.findOneAndUpdate(
    { _id: chat._id, estado: "pendiente", admin: chat.admin },
    { admin: adminNuevo },
    { new: true }
  ).populate(POBLAR);
  if (!actualizado) return false;

  emitirA([chat.admin], "chat:retirado", { chatId: String(chat._id), motivo: "reasignado" });
  emitirA([adminNuevo], "chat:nuevo", actualizado);
  await registrarAuditoria(REQ_SISTEMA, "MODIFICAR", {
    ...SISTEMA,
    entidad: "Chat",
    entidadId: chat._id,
    detalle: `Consulta pendiente reasignada a ${actualizado.admin.usuario}`,
  });
  return true;
};

// Un admin quedó desconectado: sus pendientes pasan a otro admin disponible.
// Si no hay ninguno, quedan pendientes hasta que otro admin se conecte o venza el timeout.
const reasignarPendientesDe = (adminId) =>
  encolar(async () => {
    const pendientes = await Chat.find({ admin: adminId, estado: "pendiente" }).sort({
      createdAt: 1,
    });
    for (const chat of pendientes) {
      const nuevo = await elegirAdmin({ excluir: adminId });
      if (!nuevo) break;
      await reasignar(chat, nuevo);
    }
  });

// Un admin se conectó: toma los pendientes cuyo admin ya no está conectado, hasta su límite.
// Recién arrancado el servidor se espera la gracia, para que cada admin recupere los suyos.
const asignarHuerfanos = (adminId) =>
  encolar(async () => {
    if (Date.now() - arranque < GRACIA_DESCONEXION_MS) return;
    const conectados = presencia
      .adminsConectados()
      .map((id) => new mongoose.Types.ObjectId(id));
    const huerfanos = await Chat.find({
      estado: "pendiente",
      admin: trusted({ $nin: conectados }),
    }).sort({ createdAt: 1 });

    for (const chat of huerfanos) {
      const carga = await cargaDe([adminId]);
      if (carga.get(String(adminId)) >= CHAT_MAX_POR_ADMIN) break;
      await reasignar(chat, adminId);
    }
  });

// Un admin dejó de serlo (desactivado, eliminado o con otro rol): se cierran sus
// conversaciones activas y sus pendientes se reasignan.
const liberarChatsDeAdmin = async (adminId) => {
  presencia.darDeBaja(String(adminId));
  const activos = await Chat.find({ admin: adminId, estado: "activo" }).select("_id");
  for (const { _id } of activos) {
    const chat = await Chat.findOneAndUpdate(
      { _id, estado: "activo" },
      { estado: "finalizado", motivoCierre: "admin", cerradoEl: new Date() },
      { new: true }
    );
    if (!chat) continue;
    emitirA(participantes(chat), "chat:finalizado", {
      chatId: String(chat._id),
      estado: chat.estado,
      motivo: chat.motivoCierre,
      cerradoEl: chat.cerradoEl,
    });
    await auditarCambio(REQ_SISTEMA, chat, "activo → finalizado (operador dado de baja)", SISTEMA);
  }
  await reasignarPendientesDe(adminId);
};

// ---------- Indicador de "escribiendo" (único evento cliente → servidor) ----------

const reenviarEscribiendo = async (usuario, chatId) => {
  if (!mongoose.isValidObjectId(chatId)) return;
  const chat = await Chat.findOne({ _id: chatId, estado: "activo" }).select("solicitante admin");
  if (!chat || !esParticipante(chat, usuario)) return;
  const otro = participantes(chat).find((id) => id !== String(usuario._id));
  emitirA([otro], "chat:escribiendo", { chatId: String(chat._id) });
};

presencia.alDarDeBajaAdmin(reasignarPendientesDe);

module.exports = {
  listarChats,
  obtenerChat,
  iniciarChat,
  aceptarChat,
  rechazarChat,
  finalizarChat,
  enviarMensaje,
  recuperarTimeouts,
  asignarHuerfanos,
  liberarChatsDeAdmin,
  reenviarEscribiendo,
};
