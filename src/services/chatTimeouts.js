// Temporizadores en memoria de los chats pendientes (timeout de aceptación).
// Al reiniciar el servidor se reconstruyen desde Mongo con chatService.recuperarTimeouts().
const temporizadores = new Map(); // chatId -> Timeout

// setTimeout no admite demoras mayores a ~24,8 días; el timeout del chat es de minutos.
const programar = (chatId, fecha, alVencer) => {
  const id = String(chatId);
  cancelar(id);
  const demora = Math.max(0, new Date(fecha).getTime() - Date.now());
  const temporizador = setTimeout(() => {
    temporizadores.delete(id);
    alVencer(id);
  }, demora);
  temporizador.unref();
  temporizadores.set(id, temporizador);
};

const cancelar = (chatId) => {
  const id = String(chatId);
  clearTimeout(temporizadores.get(id));
  temporizadores.delete(id);
};

module.exports = { programar, cancelar };
