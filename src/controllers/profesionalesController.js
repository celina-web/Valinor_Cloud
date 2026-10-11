const Profesional = require("../models/Profesional");
const Turno = require("../models/Turno");
const Usuario = require("../models/Usuario");
const { tomarCampos, describirCambios } = require("../helpers/campos");
const { registrarAuditoria } = require("../helpers/auditoria");

const CAMPOS = ["nombre", "apellido", "especialidad", "matricula"];

const obtenerProfesionales = async (req, res) => {
  const profesionales = await Profesional.find().sort({ apellido: 1, nombre: 1 });
  res.json(profesionales);
};

const obtenerProfesionalPorId = async (req, res) => {
  const profesional = await Profesional.findById(req.params.id);
  if (!profesional) return res.status(404).json({ error: "Profesional no encontrado" });
  res.json(profesional);
};

const crearProfesional = async (req, res) => {
  const profesional = await Profesional.create(tomarCampos(req.body, CAMPOS));
  await registrarAuditoria(req, "CREAR", {
    entidad: "Profesional",
    entidadId: profesional._id,
    detalle: `${profesional.nombre} ${profesional.apellido} (Mat. ${profesional.matricula})`,
  });
  res.status(201).json(profesional);
};

const actualizarProfesional = async (req, res) => {
  const profesional = await Profesional.findById(req.params.id);
  if (!profesional) return res.status(404).json({ error: "Profesional no encontrado" });

  profesional.set(tomarCampos(req.body, CAMPOS));
  const cambios = describirCambios(profesional);
  await profesional.save();

  await registrarAuditoria(req, "MODIFICAR", {
    entidad: "Profesional",
    entidadId: profesional._id,
    detalle: `Campos: ${cambios}`,
  });
  res.json(profesional);
};

const eliminarProfesional = async (req, res) => {
  const profesional = await Profesional.findById(req.params.id);
  if (!profesional) return res.status(404).json({ error: "Profesional no encontrado" });

  const tieneTurnosReservados = await Turno.exists({
    profesional: profesional._id,
    estado: "reservado",
  });
  if (tieneTurnosReservados) {
    return res
      .status(409)
      .json({ error: "No se puede eliminar: el profesional tiene turnos reservados" });
  }

  const tieneUsuario = await Usuario.exists({ profesional: profesional._id });
  if (tieneUsuario) {
    return res
      .status(409)
      .json({ error: "No se puede eliminar: el profesional tiene un usuario vinculado" });
  }

  await profesional.deleteOne();
  await registrarAuditoria(req, "ELIMINAR", {
    entidad: "Profesional",
    entidadId: profesional._id,
    detalle: `${profesional.nombre} ${profesional.apellido} (Mat. ${profesional.matricula})`,
  });
  res.status(204).end();
};

module.exports = {
  obtenerProfesionales,
  obtenerProfesionalPorId,
  crearProfesional,
  actualizarProfesional,
  eliminarProfesional,
};
