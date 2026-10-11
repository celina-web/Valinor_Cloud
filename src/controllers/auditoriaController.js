const Auditoria = require("../models/Auditoria");

const obtenerAuditoria = async (req, res) => {
  const { accion, usuario } = req.query;
  const filtro = {};

  if (accion) filtro.accion = String(accion);
  if (usuario) filtro.usuarioNombre = String(usuario).trim().toLowerCase();

  const registros = await Auditoria.find(filtro).sort({ createdAt: -1 }).limit(100);
  res.json(registros);
};

module.exports = { obtenerAuditoria };
