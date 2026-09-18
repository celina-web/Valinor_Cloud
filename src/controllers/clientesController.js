const { leerDB, escribirDB, siguienteId } = require('../data/db');
const Cliente = require('../models/Cliente');

const obtenerClientes = async (req, res) => {
  try {
    const db = await leerDB();
    res.json(db.clientes);
  } catch (err) {
    console.error('Error al leer el archivo:', err);
    res.status(500).json({ error: 'Error al leer el archivo' });
  }
};

const obtenerClientePorId = async (req, res) => {
  try {
    const db = await leerDB();
    const cliente = db.clientes.find((c) => c.id === parseInt(req.params.id));

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(cliente);
  } catch (err) {
    console.error('Error al leer el archivo:', err);
    res.status(500).json({ error: 'Error al leer el archivo' });
  }
};

const crearCliente = async (req, res) => {
  try {
    const db = await leerDB();

    const nuevoCliente = new Cliente({
      id: siguienteId(db.clientes),
      ...req.body,
    });

    db.clientes.push(nuevoCliente);

    await escribirDB(db);
    res.status(201).json(nuevoCliente);
  } catch (err) {
    console.error('Error al crear cliente:', err);
    res.status(500).json({ error: 'Error al crear el cliente' });
  }
};

const actualizarCliente = async (req, res) => {
  try {
    const db = await leerDB();
    const index = db.clientes.findIndex((c) => c.id === parseInt(req.params.id));

    if (index === -1) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const actualizado = new Cliente({
      ...db.clientes[index],
      ...req.body,
      id: db.clientes[index].id,
    });
    db.clientes[index] = actualizado;

    await escribirDB(db);
    res.json(actualizado);
  } catch (err) {
    console.error('Error al actualizar cliente:', err);
    res.status(500).json({ error: 'Error al actualizar el cliente' });
  }
};

const eliminarCliente = async (req, res) => {
  try {
    const db = await leerDB();
    const index = db.clientes.findIndex((c) => c.id === parseInt(req.params.id));

    if (index === -1) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    db.clientes.splice(index, 1);

    await escribirDB(db);
    res.json({ message: 'Cliente eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar cliente:', err);
    res.status(500).json({ error: 'Error al eliminar el cliente' });
  }
};

module.exports = {
  obtenerClientes,
  obtenerClientePorId,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
};
