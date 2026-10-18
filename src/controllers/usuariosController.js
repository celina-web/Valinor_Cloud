const Usuario = require("../models/Usuario");
const Profesional = require("../models/Profesional");
const Cliente = require("../models/Cliente");
const { tomarCampos, describirCambios } = require("../helpers/campos");
const { registrarAuditoria } = require("../helpers/auditoria");

const CAMPOS = [
  "usuario",
  "password",
  "nombre",
  "rol",
  "profesional",
  "cliente",
  "activo",
  "expiraEl",
];

const normalizar = (datos, rolFinal) => {
  if (datos.profesional === "") datos.profesional = null;
  if (datos.cliente === "") datos.cliente = null;
  if (datos.expiraEl === "") datos.expiraEl = null;
  if (datos.password === "") delete datos.password;
  if (datos.activo !== undefined) datos.activo = datos.activo === true || datos.activo === "true";
  if (rolFinal !== "profesional") datos.profesional = null;
  if (rolFinal !== "cliente") datos.cliente = null;
  return datos;
};

const validarProfesional = async (idProfesional) => {
  if (!idProfesional) return true;
  return Profesional.exists({ _id: idProfesional });
};

const validarCliente = async (idCliente, excluirUsuario) => {
  if (!idCliente) return true;
  const filtro = { cliente: idCliente };
  if (excluirUsuario) filtro._id = { $ne: excluirUsuario };
  return (await Cliente.exists({ _id: idCliente })) && !(await Usuario.exists(filtro));
};

const obtenerUsuarios = async (req, res) => {
  const usuarios = await Usuario.find()
    .populate("profesional", "nombre apellido")
    .populate("cliente", "nombre apellido")
    .sort({ createdAt: 1 });
  res.json(usuarios);
};

const crearUsuario = async (req, res) => {
  const datos = tomarCampos(req.body, CAMPOS);
  normalizar(datos, datos.rol || "profesional");

  if (!(await validarProfesional(datos.profesional))) {
    return res.status(400).json({ error: "El profesional seleccionado no existe" });
  }
  if (!(await validarCliente(datos.cliente))) {
    return res.status(400).json({ error: "El cliente no existe o ya tiene una cuenta" });
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
  if (!(await validarCliente(datos.cliente, usuario._id))) {
    return res.status(400).json({ error: "El cliente no existe o ya tiene una cuenta" });
  }

  usuario.set(datos);
  const cambios = describirCambios(usuario);
  await usuario.save();

  await registrarAuditoria(req, "MODIFICAR", {
    entidad: "Usuario",
    entidadId: usuario._id,
    detalle: `${usuario.usuario} - campos: ${cambios}`,
  });
  await usuario.populate([
    { path: "profesional", select: "nombre apellido" },
    { path: "cliente", select: "nombre apellido" },
  ]);
  res.json(usuario);
};

const eliminarUsuario = async (req, res) => {
  const usuario = await Usuario.findById(req.params.id);
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

  if (usuario._id.equals(req.usuario._id)) {
    return res.status(400).json({ error: "No podés eliminar tu propio usuario" });
  }

  await usuario.deleteOne();
  await registrarAuditoria(req, "ELIMINAR", {
    entidad: "Usuario",
    entidadId: usuario._id,
    detalle: `${usuario.usuario} con rol ${usuario.rol}`,
  });
  res.status(204).end();
};

module.exports = { obtenerUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario };
