const Cliente = require("../models/Cliente");
const Turno = require("../models/Turno");
const Usuario = require("../models/Usuario");
const { tomarCampos, describirCambios } = require("../helpers/campos");
const { registrarAuditoria } = require("../helpers/auditoria");

const CAMPOS = ["nombre", "apellido", "dni", "telefono", "email"];
const CAMPOS_AUTOSERVICIO = ["nombre", "apellido", "telefono", "email"];

const obtenerClientes = async (req, res) => {
  const clientes = await Cliente.find().sort({ apellido: 1, nombre: 1 });
  res.json(clientes);
};

const obtenerClientePorId = async (req, res) => {
  const cliente = await Cliente.findById(req.params.id);
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
  res.json(cliente);
};

const obtenerMiPerfil = async (req, res) => {
  const cliente = await Cliente.findById(req.usuario.cliente);
  if (!cliente) return res.status(404).json({ error: "No se encontró tu ficha de cliente" });
  res.json(cliente);
};

const actualizarMiPerfil = async (req, res) => {
  const cliente = await Cliente.findById(req.usuario.cliente);
  if (!cliente) return res.status(404).json({ error: "No se encontró tu ficha de cliente" });

  const datos = tomarCampos(req.body, CAMPOS_AUTOSERVICIO);
  const camposModificados = Object.entries(datos).filter(([campo, valor]) => {
    const actual = cliente[campo] ?? "";
    const nuevo = typeof valor === "string" ? valor.trim() : valor ?? "";
    return campo === "email"
      ? String(actual).toLowerCase() !== String(nuevo).toLowerCase()
      : actual !== nuevo;
  });

  if (!camposModificados.length) return res.json(cliente);

  cliente.set(
    Object.fromEntries(
      camposModificados.map(([campo, valor]) => [
        campo,
        typeof valor === "string" ? valor.trim() : valor,
      ])
    )
  );
  const cambios = camposModificados.map(([campo]) => campo).join(", ");
  await cliente.save();
  const nombreCompleto = `${cliente.nombre} ${cliente.apellido}`;
  if (req.usuario.nombre !== nombreCompleto) {
    await Usuario.updateOne(
      { _id: req.usuario._id },
      { nombre: nombreCompleto },
      { timestamps: false }
    );
    req.usuario.nombre = nombreCompleto;
  }

  await registrarAuditoria(req, "MODIFICAR", {
    entidad: "Cliente",
    entidadId: cliente._id,
    detalle: `Autoservicio - campos: ${cambios}`,
  });
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

  if (await Usuario.exists({ cliente: cliente._id })) {
    return res.status(409).json({ error: "No se puede eliminar: el cliente tiene un usuario vinculado" });
  }

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
  obtenerMiPerfil,
  actualizarMiPerfil,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
};
