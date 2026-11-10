// Registro en memoria de los administradores conectados por Socket.io.
// Un admin puede tener varios sockets (pestañas). Como la app es multipágina, cada
// navegación cierra y abre el socket: por eso, al quedarse sin sockets, el admin
// sigue contando como conectado durante GRACIA_DESCONEXION_MS antes de darlo de baja.
// Limitación: vale para un único proceso de Node (no hay estado compartido entre instancias).
const { GRACIA_DESCONEXION_MS } = require("../config/chat");

const sockets = new Map(); // adminId -> Set<socketId>
const gracias = new Map(); // adminId -> Timeout
let alDarDeBaja = () => {};

const cancelarGracia = (adminId) => {
  clearTimeout(gracias.get(adminId));
  gracias.delete(adminId);
};

const conectar = (adminId, socketId) => {
  cancelarGracia(adminId);
  if (!sockets.has(adminId)) sockets.set(adminId, new Set());
  sockets.get(adminId).add(socketId);
};

const darDeBaja = (adminId) => {
  cancelarGracia(adminId);
  if (!sockets.delete(adminId)) return;
  Promise.resolve(alDarDeBaja(adminId)).catch((error) => {
    console.error("Error al reasignar los chats del admin desconectado:", error.message);
  });
};

const desconectar = (adminId, socketId) => {
  const propios = sockets.get(adminId);
  if (!propios) return;
  propios.delete(socketId);
  if (propios.size > 0 || gracias.has(adminId)) return;
  const gracia = setTimeout(() => darDeBaja(adminId), GRACIA_DESCONEXION_MS);
  gracia.unref();
  gracias.set(adminId, gracia);
};

// Incluye a los admins dentro del período de gracia (están navegando entre páginas).
const adminsConectados = () => [...sockets.keys()];

const estaConectado = (adminId) => sockets.has(String(adminId));

// El servicio de chat se engancha acá para reasignar pendientes (evita un require circular).
const alDarDeBajaAdmin = (funcion) => {
  alDarDeBaja = funcion;
};

module.exports = {
  conectar,
  desconectar,
  darDeBaja,
  adminsConectados,
  estaConectado,
  alDarDeBajaAdmin,
};
