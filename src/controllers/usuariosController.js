const Usuario = require("../models/Usuario");
const Profesional = require("../models/Profesional");
const { tomarCampos, describirCambios } = require("../helpers/campos");
const { registrarAuditoria } = require("../helpers/auditoria");
const { firmarToken, enviarTokenEnCookie } = require("../helpers/token");
const { desconectarUsuario } = require("../socket/emisor");
const { liberarChatsDeAdmin } = require("../services/chatService");

const CAMPOS = ["usuario", "password", "nombre", "rol", "profesional", "activo", "expiraEl"];

const normalizar = (datos, rolFinal) => {
  if (datos.profesional === "") datos.profesional = null;
  if (datos.expiraEl === "") datos.expiraEl = null;
  if (datos.password === "") delete datos.password;
  if (datos.activo !== undefined) datos.activo = datos.activo === true || datos.activo === "true";
  if (rolFinal !== "profesional") datos.profesional = null;
  return datos;
};

const validarProfesional = async (idProfesional) => {
  if (!idProfesional) return true;
  return Profesional.exists({ _id: idProfesional });
};

const obtenerUsuarios = async (req, res) => {
  const usuarios = await Usuario.find()
    .populate("profesional", "nombre apellido")
    .sort({ createdAt: 1 });
  res.json(usuarios);
};

const crearUsuario = async (req, res) => {
  const datos = tomarCampos(req.body, CAMPOS);
  normalizar(datos, datos.rol || "profesional");

  if (!(await validarProfesional(datos.profesional))) {
    return res.status(400).json({ error: "El profesional seleccionado no existe" });
  }

  const usuario = await Usuario.create(datos);
  await registrarAuditoria(req, "CREAR", {
    entidad: "Usuario",
    entidadId: usuario._id,
    detalle: `${usuario.usuario} con rol ${usuario.rol}`,
  });
  res.status(201).json(usuario);
};

const actualizarUsuario = async (req, res) => {
  const usuario = await Usuario.findById(req.params.id);
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

  const datos = tomarCampos(req.body, CAMPOS);
  normalizar(datos, datos.rol || usuario.rol);

  const esElMismo = usuario._id.equals(req.usuario._id);
  const seQuitaPermisos =
    datos.activo === false || (datos.rol && datos.rol !== usuario.rol) || Boolean(datos.expiraEl);
  if (esElMismo && seQuitaPermisos) {
    return res
      .status(400)
      .json({ error: "No podés cambiar tu rol, desactivarte ni ponerte vencimiento" });
  }

  if (!(await validarProfesional(datos.profesional))) {
    return res.status(400).json({ error: "El profesional seleccionado no existe" });
  }

  const eraAdmin = usuario.rol === "admin";
  usuario.set(datos);
  const cambios = describirCambios(usuario);
  await usuario.save();

  // Los sockets del chat se autenticaron con los datos anteriores: se cierran para que
  // se reconecten (o sean rechazados) con el estado nuevo. El propio admin no cambia de permisos.
  if (!esElMismo && (seQuitaPermisos || datos.password)) desconectarUsuario(usuario._id);
  if (eraAdmin && !(usuario.rol === "admin" && usuario.estaHabilitado())) {
    await liberarChatsDeAdmin(usuario._id);
  }

  // Cambiar la contraseña invalida los tokens anteriores (tokenVersion); si es la
  // propia, se emite uno nuevo para no cerrarle la sesión al admin.
  if (esElMismo && datos.password) enviarTokenEnCookie(res, firmarToken(usuario));

  await registrarAuditoria(req, "MODIFICAR", {
    entidad: "Usuario",
    entidadId: usuario._id,
    detalle: `${usuario.usuario} - campos: ${cambios}`,
  });
  await usuario.populate("profesional", "nombre apellido");
  res.json(usuario);
};

const eliminarUsuario = async (req, res) => {
  const usuario = await Usuario.findById(req.params.id);
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

  if (usuario._id.equals(req.usuario._id)) {
    return res.status(400).json({ error: "No podés eliminar tu propio usuario" });
  }

  await usuario.deleteOne();
  desconectarUsuario(usuario._id);
  if (usuario.rol === "admin") await liberarChatsDeAdmin(usuario._id);
  await registrarAuditoria(req, "ELIMINAR", {
    entidad: "Usuario",
    entidadId: usuario._id,
    detalle: `${usuario.usuario} con rol ${usuario.rol}`,
  });
  res.status(204).end();
};

module.exports = { obtenerUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario };
