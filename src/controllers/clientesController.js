const fs = require('fs');
const path = require('path');

const Profesional = path.join(__dirname, '../models/Profesional.js');

const rutaArchivo = path.join(__dirname, '../../data/db.json');

// Helpers para no leer y escribir
const leerDB = () =>
  new Promise((resolve, reject) => {
    fs.readFile(rutaArchivo, 'utf8', (err, data) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
  });

const escribirDB = (db) =>
  new Promise((resolve, reject) => {
    fs.writeFile(rutaArchivo, JSON.stringify(db, null, 2), 'utf8', (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

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

    const nuevoId = db.clientes.length
      ? Math.max(...db.clientes.map((c) => c.id)) + 1
      : 1;

    const nuevoCliente = { id: nuevoId, ...req.body };
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

    db.clientes[index] = { ...db.clientes[index], ...req.body };

    await escribirDB(db);
    res.json(db.clientes[index]);
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