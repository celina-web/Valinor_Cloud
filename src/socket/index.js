// Servidor de Socket.io: empuja en tiempo real los eventos del chat al navegador.
// Las acciones (iniciar, aceptar, enviar mensaje, etc.) van por la API REST /api/chats;
// por el socket el cliente solo manda el indicador "escribiendo".
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");

const { autenticar } = require("../middlewares/auth");
const presencia = require("./presencia");
const { registrarIO, salaDeUsuario } = require("./emisor");
const chatService = require("../services/chatService");

const parsearCookies = cookieParser();
const ERROR_AUTENTICACION = "NO_AUTENTICADO";

// Handshake: se reutiliza la estrategia jwt de Passport (cookie httpOnly o header Bearer),
// así el socket valida firma, vencimiento, tokenVersion y estado del usuario igual que la API.
const autenticarSocket = async (socket, next) => {
  try {
    const req = socket.request;
    parsearCookies(req, {}, () => {});
    const { usuario, info } = await autenticar("jwt", req, {});
    if (!usuario) return next(new Error(ERROR_AUTENTICACION));

    socket.data.usuario = {
      _id: String(usuario._id),
      usuario: usuario.usuario,
      nombre: usuario.nombre,
      rol: usuario.rol,
    };
    socket.data.exp = info.payload ? info.payload.exp : null;
    return next();
  } catch (error) {
    return next(error);
  }
};

// El socket no se entera de la renovación de la cookie: al vencer el token con el que se
// conectó, se lo desconecta y el cliente vuelve a conectarse con la cookie vigente.
const programarVencimiento = (socket) => {
  if (!socket.data.exp) return;
  const demora = socket.data.exp * 1000 - Date.now();
  const temporizador = setTimeout(() => socket.disconnect(true), Math.max(0, demora));
  temporizador.unref();
  socket.once("disconnect", () => clearTimeout(temporizador));
};

const alConectar = (socket) => {
  const { usuario } = socket.data;
  socket.join(salaDeUsuario(usuario._id));
  programarVencimiento(socket);

  if (usuario.rol === "admin") {
    presencia.conectar(usuario._id, socket.id);
    chatService.asignarHuerfanos(usuario._id).catch((error) => {
      console.error("No se pudieron asignar los chats pendientes:", error.message);
    });
  }

  socket.on("chat:escribiendo", (datos) => {
    const chatId = datos && datos.chatId;
    chatService.reenviarEscribiendo(usuario, chatId).catch(() => {});
  });

  socket.on("disconnect", () => {
    if (usuario.rol === "admin") presencia.desconectar(usuario._id, socket.id);
  });
};

const iniciarSocket = (servidorHttp) => {
  // Mismo origen que la app: no hace falta configurar CORS.
  const io = new Server(servidorHttp);
  io.use(autenticarSocket);
  io.on("connection", alConectar);
  registrarIO(io);
  return io;
};

module.exports = { iniciarSocket };
