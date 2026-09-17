const fs = require('fs');
const path = require('path');

const Profesional = path.join(__dirname, '../models/Profesional.json');

const rutaArchivo = path.join(__dirname, '../../data/db.json');

const obtenerProfesionales = (req, res) => {
  fs.readFile(rutaArchivo, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      return res.status(500).json({ error: 'Error al leer el archivo' });
    }

    const profesionales = JSON.parse(data);
    res.json(profesionales);
  });
};

const obtenerProfesionalPorId = (req, res) => {
  const profesionalId = req.params.id;

  fs.readFile(rutaArchivo, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      return res.status(500).json({ error: 'Error al leer el archivo' });
    }

    const profesionales = JSON.parse(data);
    const profesional = profesionales.find((p) => p.id === parseInt(profesionalId));

    if (!profesional) {
      return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    res.json(profesional);
  });
};

const crearProfesional = (req, res) => {
  const nuevoProfesional = req.body;

  fs.readFile(rutaArchivo, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      return res.status(500).json({ error: 'Error al leer el archivo' });
    }

    const profesionales = JSON.parse(data);
    nuevoProfesional.id = profesionales.length + 1; // Asignar un ID único
    profesionales.push(nuevoProfesional);

    fs.writeFile(rutaArchivo, JSON.stringify(profesionales, null, 2), (err) => {
      if (err) {
        console.error('Error al escribir en el archivo:', err);
        return res.status(500).json({ error: 'Error al escribir en el archivo' });
      }

      res.status(201).json(nuevoProfesional);
    });
  });
};

const eliminarProfesional = (req, res) => {
  const profesionalId = req.params.id;

  fs.readFile(rutaArchivo, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      return res.status(500).json({ error: 'Error al leer el archivo' });
    }

    let profesionales = JSON.parse(data);
    const profesionalIndex = profesionales.findIndex((p) => p.id === parseInt(profesionalId));

    if (profesionalIndex === -1) {
      return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    profesionales.splice(profesionalIndex, 1);

    fs.writeFile(rutaArchivo, JSON.stringify(profesionales, null, 2), (err) => {
      if (err) {
        console.error('Error al escribir en el archivo:', err);
        return res.status(500).json({ error: 'Error al escribir en el archivo' });
      }

      res.json({ message: 'Profesional eliminado correctamente' });
    });
  });
};

module.exports = {
  obtenerProfesionales,
  obtenerProfesionalPorId,
  crearProfesional
};