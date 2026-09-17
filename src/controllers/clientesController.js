const fs = require('fs');
const path = require('path');

const Cliente = path.join(__dirname, '../models/Cliente.json');

const rutaArchivo = path.join(__dirname, '../../data/db.json');

const obtenerClientes = (req, res) => {
  fs.readFile(rutaArchivo, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      return res.status(500).json({ error: 'Error al leer el archivo' });
    }

    const clientes = JSON.parse(data);
    res.json(clientes);
  });
};

const obtenerClientePorId = (req, res) => {
  const clienteId = req.params.id;

  fs.readFile(rutaArchivo, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      return res.status(500).json({ error: 'Error al leer el archivo' });
    }

    const clientes = JSON.parse(data);
    const cliente = clientes.find((c) => c.id === parseInt(clienteId));

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(cliente);
  });
};

const crearCliente = (req, res) => {
  const nuevoCliente = req.body;

  fs.readFile(rutaArchivo, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      return res.status(500).json({ error: 'Error al leer el archivo' });
    }

    const clientes = JSON.parse(data);
    nuevoCliente.id = clientes.length + 1; // Asignar un ID único
    clientes.push(nuevoCliente);

    fs.writeFile(rutaArchivo, JSON.stringify(clientes, null, 2), (err) => {
      if (err) {
        console.error('Error al escribir en el archivo:', err);
        return res.status(500).json({ error: 'Error al escribir en el archivo' });
      }

      res.status(201).json(nuevoCliente);
    });
  });
};

const actualizarCliente = (req, res) => {
  const clienteId = req.params.id;
  const datosActualizados = req.body;

  fs.readFile(rutaArchivo, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      return res.status(500).json({ error: 'Error al leer el archivo' });
    }

    const clientes = JSON.parse(data);
    const clienteIndex = clientes.findIndex((c) => c.id === parseInt(clienteId));

    if (clienteIndex === -1) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    clientes[clienteIndex] = { ...clientes[clienteIndex], ...datosActualizados };

    fs.writeFile(rutaArchivo, JSON.stringify(clientes, null, 2), (err) => {
      if (err) {
        console.error('Error al escribir en el archivo:', err);
        return res.status(500).json({ error: 'Error al escribir en el archivo' });
      }

      res.json(clientes[clienteIndex]);
    });
  });
};

const eliminarCliente = (req, res) => {
  const clienteId = req.params.id;

  fs.readFile(rutaArchivo, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      return res.status(500).json({ error: 'Error al leer el archivo' });
    }

    let clientes = JSON.parse(data);
    const clienteIndex = clientes.findIndex((c) => c.id === parseInt(clienteId));

    if (clienteIndex === -1) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    clientes.splice(clienteIndex, 1);

    fs.writeFile(rutaArchivo, JSON.stringify(clientes, null, 2), (err) => {
      if (err) {
        console.error('Error al escribir en el archivo:', err);
        return res.status(500).json({ error: 'Error al escribir en el archivo' });
      }

      res.json({ message: 'Cliente eliminado correctamente' });
    });
  });
};

module.exports = {
  obtenerClientes,
  obtenerClientePorId,
  crearCliente,
  actualizarCliente,
  eliminarCliente
};