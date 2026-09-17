const fs = require('fs');
const path = require('path');

const Profesional = path.join(__dirname, '../models/Profesional.js');

const rutaArchivo = path.join(__dirname, '../../data/db.json');

// Helpers para leer y escribir en el archivo JSON
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

const obtenerProfesionales = async (req, res) => {
  try {
    const db = await leerDB();
    res.json(db.profesionales);
  } catch (err) {
    console.error('Error al leer el archivo:', err);
    res.status(500).json({ error: 'Error al leer el archivo' });
  }
};

const obtenerProfesionalPorId = async (req, res) => {
  try {
    const db = await leerDB();
    const profesional = db.profesionales.find((p) => p.id === parseInt(req.params.id));
    if (!profesional) {
      return res.status(404).json({ error: 'Profesional no encontrado' });
    }
    res.json(profesional);
  } catch (err) {
    console.error('Error al leer el archivo:', err);
    res.status(500).json({ error: 'Error al leer el archivo' });
  }
};

const crearProfesional = async (req, res) => {
  try {
    const db = await leerDB();

    const nuevoId = db.profesionales.length
      ? Math.max(...db.profesionales.map((p) => p.id)) + 1
      : 1;

    const nuevoProfesional = { id: nuevoId, ...req.body };
    db.profesionales.push(nuevoProfesional);

    await escribirDB(db);
    res.status(201).json(nuevoProfesional);
  } catch (err) {
    console.error('Error al crear profesional:', err);
    res.status(500).json({ error: 'Error al crear el profesional' });
  }
};

const actualizarProfesional = async (req, res) => {
  try {
    const db = await leerDB();
    const index = db.profesionales.findIndex((p) => p.id === parseInt(req.params.id));

    if (index === -1) {
      return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    db.profesionales[index] = { ...db.profesionales[index], ...req.body };

    await escribirDB(db);
    res.json(db.profesionales[index]);
  } catch (err) {
    console.error('Error al actualizar profesional:', err);
    res.status(500).json({ error: 'Error al actualizar el profesional' });
  }
};

const eliminarProfesional = async (req, res) => {
  try {
    const db = await leerDB();
    const index = db.profesionales.findIndex((p) => p.id === parseInt(req.params.id));

    if (index === -1) {
      return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    db.profesionales.splice(index, 1);

    await escribirDB(db);
    res.json({ message: 'Profesional eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar profesional:', err);
    res.status(500).json({ error: 'Error al eliminar el profesional' });
  }
};

module.exports = {
  obtenerProfesionales,
  obtenerProfesionalPorId,
  crearProfesional,
  actualizarProfesional,
  eliminarProfesional,
};