const Usuario = require("../models/Usuario");
const { permisosDe } = require("../config/roles");
const { registrarAuditoria } = require("../helpers/auditoria");
const { destruirSesion } = require("../middlewares/auth");

const regenerarSesion = (req) =>
  new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });

const login = async (req, res) => {
  const { usuario: usuarioIngresado, password: passwordIngresada } = req.body || {};
  const nombreUsuario = String(usuarioIngresado || "").trim().toLowerCase();
  const password = String(passwordIngresada || "");

  if (!nombreUsuario || !password) {
    return res.status(400).json({ error: "Ingresá usuario y contraseña" });
  }

  const usuario = await Usuario.findOne({ usuario: nombreUsuario }).select("+password");

  if (!usuario || usuario.password !== password) {
    await registrarAuditoria(req, "LOGIN_FALLIDO", {
      usuarioNombre: nombreUsuario,
      detalle: "Usuario o contraseña incorrectos",
    });
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }

  if (!usuario.estaHabilitado()) {
    await registrarAuditoria(req, "LOGIN_FALLIDO", {
      usuario,
      detalle: "Usuario desactivado o vencido",
    });
    return res
      .status(403)
      .json({ error: "Tu usuario está deshabilitado. Contactá a un administrador" });
  }

  await regenerarSesion(req);
  req.session.usuarioId = usuario._id.toString();
  req.session.usuarioNombre = usuario.usuario;

  await Usuario.updateOne(
    { _id: usuario._id },
    { ultimoAcceso: new Date() },
    { timestamps: false }
  );
  await registrarAuditoria(req, "LOGIN", { usuario, entidad: "Usuario", entidadId: usuario._id });

  res.json({ usuario: usuario.usuario, nombre: usuario.nombre, rol: usuario.rol });
};

const logout = async (req, res) => {
  await registrarAuditoria(req, "LOGOUT", { entidad: "Usuario", entidadId: req.usuario._id });
  await destruirSesion(req);
  res.clearCookie("connect.sid");
  res.status(204).end();
};

const usuarioActual = (req, res) => {
  const { usuario, nombre, rol, ultimoAcceso } = req.usuario;
  res.json({ usuario, nombre, rol, ultimoAcceso, permisos: permisosDe(rol) });
};

module.exports = { login, logout, usuarioActual };
