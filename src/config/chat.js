// Parámetros del chat de consultas. Los minutos aceptan decimales (útil para probar el timeout).
const numeroPositivo = (valor, porDefecto) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : porDefecto;
};

const CHAT_MAX_POR_ADMIN = Math.floor(numeroPositivo(process.env.CHAT_MAX_POR_ADMIN, 3));
const CHAT_TIMEOUT_MINUTOS = numeroPositivo(process.env.CHAT_TIMEOUT_MINUTOS, 5);

module.exports = {
  CHAT_MAX_POR_ADMIN,
  CHAT_TIMEOUT_MS: CHAT_TIMEOUT_MINUTOS * 60 * 1000,
  // Un admin que cierra todas sus pestañas (o navega entre páginas) sigue "conectado" este tiempo.
  GRACIA_DESCONEXION_MS: 10 * 1000,
  MENSAJE_SIN_OPERADORES: "Todos los operadores se encuentran ocupados en este momento",
};
