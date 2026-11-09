const Usuario = require("../models/Usuario");
const { permisosDe } = require("../config/roles");
const { registrarAuditoria } = require("../helpers/auditoria");
const { autenticar } = require("../middlewares/auth");
const { firmarToken, enviarTokenEnCookie, borrarCookieToken } = require("../helpers/token");

const login = async (req, res) => {
  const { usuario: usuarioIngresado, password } = req.body || {};

  if (!String(usuarioIngresado || "").trim() || !password) {
    return res.status(400).json({ error: "Ingresá usuario y contraseña" });
  }

  const { usuario, info } = await autenticar("local", req, res);

  if (!usuario) {
    await registrarAuditoria(req, "LOGIN_FALLIDO", {
      usuario: info.usuario,
      usuarioNombre: info.usuarioNombre,
      detalle: info.detalle,
    });
    return res.status(info.status || 401).json({ error: info.error || "No se pudo iniciar sesión" });
  }

  const token = firmarToken(usuario);
  enviarTokenEnCookie(res, token);

  await Usuario.updateOne(
    { _id: usuario._id },
    { ultimoAcceso: new Date() },
    { timestamps: false }
  );
  await registrarAuditoria(req, "LOGIN", { usuario, entidad: "Usuario", entidadId: usuario._id });

  res.json({ token, usuario: usuario.usuario, nombre: usuario.nombre, rol: usuario.rol });
};

// Sin sesiones en el servidor: el logout sube tokenVersion para invalidar los
// tokens ya emitidos de este usuario y borra la cookie del navegador.
const logout = async (req, res) => {
  await Usuario.updateOne(
    { _id: req.usuario._id },
    { $inc: { tokenVersion: 1 } },
    { timestamps: false }
  );
  await registrarAuditoria(req, "LOGOUT", { entidad: "Usuario", entidadId: req.usuario._id });
  borrarCookieToken(res);
  res.status(204).end();
};

const usuarioActual = (req, res) => {
  const { usuario, nombre, rol, ultimoAcceso } = req.usuario;
  res.json({ usuario, nombre, rol, ultimoAcceso, permisos: permisosDe(rol) });
};

module.exports = { login, logout, usuarioActual };
