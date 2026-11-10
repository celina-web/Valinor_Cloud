// Error de negocio con status HTTP: el errorHandler lo responde con su propio mensaje.
const crearError = (status, mensaje) => Object.assign(new Error(mensaje), { status, expuesto: true });

module.exports = { crearError };
