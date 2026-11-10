// Referencia al servidor de Socket.io para emitir desde servicios y controladores
// sin dependencias circulares. Cada usuario tiene su sala "usuario:<id>", así un
// evento llega a todas sus pestañas aunque el socket se reconecte al navegar.
let io = null;

const salaDeUsuario = (id) => `usuario:${id}`;

const registrarIO = (servidor) => {
  io = servidor;
};

const emitirA = (usuarioIds, evento, datos) => {
  if (!io) return;
  const salas = [...new Set(usuarioIds.filter(Boolean).map((id) => salaDeUsuario(String(id))))];
  if (salas.length) io.to(salas).emit(evento, datos);
};

// Cierra todos los sockets de un usuario (logout, desactivación, cambio de rol, etc.).
const desconectarUsuario = (id) => {
  if (io) io.in(salaDeUsuario(String(id))).disconnectSockets(true);
};

module.exports = { registrarIO, salaDeUsuario, emitirA, desconectarUsuario };
