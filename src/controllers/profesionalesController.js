const { leerDB, escribirDB, siguienteId } = require('../data/db');
const Profesional = require('../models/Profesional');

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

    const nuevoProfesional = new Profesional({
      id: siguienteId(db.profesionales),
      ...req.body,
    });

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

    const actualizado = new Profesional({
      ...db.profesionales[index],
      ...req.body,
      id: db.profesionales[index].id,
    });
    db.profesionales[index] = actualizado;

    await escribirDB(db);
    res.json(actualizado);
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
