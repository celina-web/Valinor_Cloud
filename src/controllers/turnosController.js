const Turno = require("../models/Turno");
const Cliente = require("../models/Cliente");
const Profesional = require("../models/Profesional");
const { registrarAuditoria } = require("../helpers/auditoria");

const POBLAR = [
  { path: "cliente", select: "nombre apellido dni" },
  { path: "profesional", select: "nombre apellido especialidad" },
];

const ESTADOS_FINALES = ["atendido", "cancelado"];

const esProfesional = (usuario) => usuario.rol === "profesional";
const esCliente = (usuario) => usuario.rol === "cliente";

const perteneceAlProfesional = (turno, usuario) => {
  const idProfesional = turno.profesional && (turno.profesional._id || turno.profesional);
  return String(idProfesional) === String(usuario.profesional);
};

const denegarPorContexto = async (req, res, turno, mensaje) => {
  await registrarAuditoria(req, "ACCESO_DENEGADO", {
    entidad: "Turno",
    entidadId: turno._id,
    detalle: mensaje,
  });
  return res.status(403).json({ error: mensaje });
};

const obtenerTurnos = async (req, res) => {
  const { estado, fecha, cliente, profesional } = req.query;
  const filtro = {};

  if (estado) filtro.estado = String(estado);
  if (fecha) filtro.fecha = String(fecha);
  if (cliente) filtro.cliente = String(cliente);
  if (profesional) filtro.profesional = String(profesional);
  if (esProfesional(req.usuario)) filtro.profesional = req.usuario.profesional;
  if (esCliente(req.usuario)) {
    if (!req.usuario.cliente) return res.json([]);
    filtro.cliente = req.usuario.cliente;
  }

  const turnos = await Turno.find(filtro).populate(POBLAR).sort({ fecha: 1, hora: 1 });
  res.json(turnos);
};

const obtenerTurnoPorId = async (req, res) => {
  const turno = await Turno.findById(req.params.id).populate(POBLAR);
  if (!turno) return res.status(404).json({ error: "Turno no encontrado" });
  const idClienteTurno = turno.cliente && (turno.cliente._id || turno.cliente);

  if (
    (esProfesional(req.usuario) && !perteneceAlProfesional(turno, req.usuario)) ||
    (esCliente(req.usuario) &&
      (!req.usuario.cliente ||
        String(idClienteTurno) !== String(req.usuario.cliente)))
  ) {
    return denegarPorContexto(req, res, turno, "Solo podés ver tus propios turnos");
  }
  res.json(turno);
};

const crearTurno = async (req, res) => {
  const { cliente, profesional, fecha, hora } = req.body || {};
  const turno = new Turno({ cliente, profesional, fecha, hora, creadoPor: req.usuario._id });

  await turno.validate();

  const [clienteExiste, profesionalExiste] = await Promise.all([
    Cliente.exists({ _id: turno.cliente }),
    Profesional.exists({ _id: turno.profesional }),
  ]);
  if (!clienteExiste) return res.status(400).json({ error: "El cliente seleccionado no existe" });
  if (!profesionalExiste) {
    return res.status(400).json({ error: "El profesional seleccionado no existe" });
  }

  const mismoHorario = { fecha: turno.fecha, hora: turno.hora, estado: "reservado" };

  const profesionalOcupado = await Turno.exists({ ...mismoHorario, profesional: turno.profesional });
  if (profesionalOcupado) {
    return res
      .status(409)
      .json({ error: "El profesional ya tiene un turno reservado en esa fecha y hora" });
  }

  const clienteOcupado = await Turno.exists({ ...mismoHorario, cliente: turno.cliente });
  if (clienteOcupado) {
    return res
      .status(409)
      .json({ error: "El cliente ya tiene un turno reservado en esa fecha y hora" });
  }

  await turno.save();
  await turno.populate(POBLAR);

  await registrarAuditoria(req, "CREAR", {
    entidad: "Turno",
    entidadId: turno._id,
    detalle: `${turno.fecha} ${turno.hora} - ${turno.profesional.apellido} / ${turno.cliente.apellido}`,
  });
  res.status(201).json(turno);
};

const cambiarEstadoTurno = async (req, res) => {
  const { estado } = req.body || {};

  if (!ESTADOS_FINALES.includes(estado)) {
    return res.status(400).json({ error: "Estado no válido. Use: atendido o cancelado" });
  }

  const turno = await Turno.findById(req.params.id);
  if (!turno) return res.status(404).json({ error: "Turno no encontrado" });

  if (esProfesional(req.usuario)) {
    if (!perteneceAlProfesional(turno, req.usuario)) {
      return denegarPorContexto(req, res, turno, "Solo podés modificar tus propios turnos");
    }
    if (estado !== "atendido") {
      return denegarPorContexto(req, res, turno, "Un profesional solo puede marcar turnos como atendidos");
    }
  }

  if (turno.estado !== "reservado") {
    return res
      .status(400)
      .json({ error: `El turno ya está en estado "${turno.estado}" y no puede modificarse` });
  }

  const estadoAnterior = turno.estado;
  turno.estado = estado;
  await turno.save();
  await turno.populate(POBLAR);

  await registrarAuditoria(req, "CAMBIO_ESTADO", {
    entidad: "Turno",
    entidadId: turno._id,
    detalle: `${estadoAnterior} → ${estado}`,
  });
  res.json(turno);
};

const eliminarTurno = async (req, res) => {
  const turno = await Turno.findById(req.params.id);
  if (!turno) return res.status(404).json({ error: "Turno no encontrado" });

  if (turno.estado !== "cancelado") {
    return res.status(400).json({ error: "Solo se pueden eliminar turnos cancelados" });
  }

  await turno.deleteOne();
  await registrarAuditoria(req, "ELIMINAR", {
    entidad: "Turno",
    entidadId: turno._id,
    detalle: `${turno.fecha} ${turno.hora}`,
  });
  res.status(204).end();
};

module.exports = {
  obtenerTurnos,
  obtenerTurnoPorId,
  crearTurno,
  cambiarEstadoTurno,
  eliminarTurno,
};
