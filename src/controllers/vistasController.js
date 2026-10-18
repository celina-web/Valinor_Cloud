const { ROLES } = require("../config/roles");
const { ACCIONES } = require("../models/Auditoria");

const mostrarLogin = (req, res) => {
  if (req.session.usuarioId) return res.redirect("/");
  res.render("login");
};

const mostrarRegistro = (req, res) => res.render("registro");

const mostrarMiPerfil = (req, res) => {
  if (req.usuario.rol !== "cliente") return res.redirect("/");
  res.render("mi-perfil");
};

const mostrarPanel = (req, res) => res.render("home");

const mostrarClientes = (req, res) => res.render("clientes/index");

const mostrarProfesionales = (req, res) => res.render("profesionales/index");

const mostrarTurnos = (req, res) => res.render("turnos/index");

const mostrarUsuarios = (req, res) => res.render("usuarios/index", { roles: ROLES });

const mostrarAuditoria = (req, res) => res.render("auditoria/index", { acciones: ACCIONES });

module.exports = {
  mostrarLogin,
  mostrarRegistro,
  mostrarMiPerfil,
  mostrarPanel,
  mostrarClientes,
  mostrarProfesionales,
  mostrarTurnos,
  mostrarUsuarios,
  mostrarAuditoria,
};
