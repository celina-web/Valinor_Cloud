const Auditoria = require("../models/Auditoria");

const registrarAuditoria = async (req, accion, datos = {}) => {
  const autor = datos.usuario || req.usuario;
  try {
    await Auditoria.create({
      usuario: autor ? autor._id : null,
      usuarioNombre: autor ? autor.usuario : datos.usuarioNombre || "anónimo",
      accion,
      entidad: datos.entidad,
      entidadId: datos.entidadId ? String(datos.entidadId) : undefined,
      detalle: datos.detalle,
      ip: req.ip,
    });
  } catch (error) {
    console.error("No se pudo registrar la auditoría:", error.message);
  }
};

module.exports = { registrarAuditoria };
