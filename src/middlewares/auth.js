const Usuario = require("../models/Usuario");
const { tienePermiso, permisosDe } = require("../config/roles");
const { registrarAuditoria } = require("../helpers/auditoria");

const esApi = (req) => req.originalUrl.startsWith("/api");

const destruirSesion = (req) =>
  new Promise((resolve) => {
    req.session.destroy(() => resolve());
  });

const responderSinSesion = (req, res, mensaje) => {
  if (esApi(req)) return res.status(401).json({ error: mensaje });
  return res.redirect("/login");
};

const requiereLogin = async (req, res, next) => {
  if (!req.session.usuarioId) {
    return responderSinSesion(req, res, "Debés iniciar sesión");
  }

  const usuario = await Usuario.findById(req.session.usuarioId);

  if (!usuario || !usuario.estaHabilitado()) {
    await registrarAuditoria(req, "SESION_REVOCADA", {
      usuario,
      usuarioNombre: req.session.usuarioNombre,
      entidad: "Usuario",
      entidadId: req.session.usuarioId,
      detalle: usuario ? "Usuario desactivado o vencido" : "El usuario fue eliminado",
    });
    await destruirSesion(req);
    return responderSinSesion(req, res, "Tu sesión fue revocada");
  }

  req.usuario = usuario;
  res.locals.usuario = usuario;
  res.locals.permisos = permisosDe(usuario.rol);
  res.locals.puede = (permiso) => tienePermiso(usuario.rol, permiso);
  next();
};

const requierePermiso = (permiso) => async (req, res, next) => {
  if (tienePermiso(req.usuario.rol, permiso)) return next();

  await registrarAuditoria(req, "ACCESO_DENEGADO", {
    detalle: `${req.method} ${req.originalUrl} requiere ${permiso}`,
  });

  if (esApi(req)) {
    return res.status(403).json({ error: "No tenés permiso para realizar esta acción" });
  }
  return res.status(403).render("error", {
    titulo: "Acceso denegado",
    mensaje: "No tenés permiso para ver esta página.",
  });
};

module.exports = { requiereLogin, requierePermiso, destruirSesion };
