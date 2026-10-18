const Cliente = require("../models/Cliente");
const Turno = require("../models/Turno");
const { tomarCampos, describirCambios } = require("../helpers/campos");
const { registrarAuditoria } = require("../helpers/auditoria");

const CAMPOS = ["nombre", "apellido", "dni", "telefono", "email"];

const obtenerClientes = async (req, res) => {
  const clientes = await Cliente.find().sort({ apellido: 1, nombre: 1 });
  res.json(clientes);
};

const obtenerClientePorId = async (req, res) => {
  const cliente = await Cliente.findById(req.params.id);
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
  res.json(cliente);
};

const crearCliente = async (req, res) => {
  const cliente = await Cliente.create(tomarCampos(req.body, CAMPOS));
  await registrarAuditoria(req, "CREAR", {
    entidad: "Cliente",
    entidadId: cliente._id,
    detalle: `${cliente.nombre} ${cliente.apellido} (DNI ${cliente.dni})`,
  });
  res.status(201).json(cliente);
};

const actualizarCliente = async (req, res) => {
  const cliente = await Cliente.findById(req.params.id);
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

  cliente.set(tomarCampos(req.body, CAMPOS));
  const cambios = describirCambios(cliente);
  await cliente.save();

  await registrarAuditoria(req, "MODIFICAR", {
    entidad: "Cliente",
    entidadId: cliente._id,
    detalle: `Campos: ${cambios}`,
  });
  res.json(cliente);
};

const eliminarCliente = async (req, res) => {
  const cliente = await Cliente.findById(req.params.id);
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

  const tieneTurnosReservados = await Turno.exists({ cliente: cliente._id, estado: "reservado" });
  if (tieneTurnosReservados) {
    return res.status(409).json({ error: "No se puede eliminar: el cliente tiene turnos reservados" });
  }

  await cliente.deleteOne();
  await registrarAuditoria(req, "ELIMINAR", {
    entidad: "Cliente",
    entidadId: cliente._id,
    detalle: `${cliente.nombre} ${cliente.apellido} (DNI ${cliente.dni})`,
  });
  res.status(204).end();
};

module.exports = {
  obtenerClientes,
  obtenerClientePorId,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
};
