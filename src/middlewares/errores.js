const esApi = (req) => req.originalUrl.startsWith("/api");

const notFound = (req, res) => {
  if (esApi(req)) return res.status(404).json({ error: "Ruta inexistente" });
  res.status(404).render("error", {
    titulo: "Página no encontrada",
    mensaje: "La página que buscás no existe.",
  });
};

const traducirError = (err) => {
  if (err.name === "ValidationError") {
    const primero = Object.values(err.errors)[0];
    const mensaje =
      primero.name === "CastError" ? `El valor de "${primero.path}" no es válido` : primero.message;
    return { status: 400, mensaje };
  }
  if (err.name === "CastError") {
    return { status: 400, mensaje: `El valor de "${err.path}" no es válido` };
  }
  if (err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || "dato";
    return { status: 409, mensaje: `Ya existe un registro con ese ${campo}` };
  }
  if (err.status >= 400 && err.status < 500) {
    return { status: err.status, mensaje: "La solicitud no es válida" };
  }
  return { status: 500, mensaje: "Error interno del servidor" };
};

const errorHandler = (err, req, res, next) => {
  const { status, mensaje } = traducirError(err);
  if (status === 500) console.error("Error no controlado:", err);

  if (esApi(req)) return res.status(status).json({ error: mensaje });
  res.status(status).render("error", { titulo: "Ocurrió un error", mensaje });
};

module.exports = { notFound, errorHandler };
