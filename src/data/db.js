const fs = require('fs');
const path = require('path');

const carpetaDatos = path.join(__dirname, '../../data');

const rutaColeccion = (coleccion) =>
  path.join(carpetaDatos, `${coleccion}.json`);

const leerColeccion = (coleccion) =>
  new Promise((resolve, reject) => {
    fs.readFile(rutaColeccion(coleccion), 'utf8', (err, data) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
  });

const escribirColeccion = (coleccion, datos) =>
  new Promise((resolve, reject) => {
    fs.writeFile(
      rutaColeccion(coleccion),
      JSON.stringify(datos, null, 2),
      'utf8',
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });

const leerDB = async () => {
  const [clientes, profesionales, turnos] = await Promise.all([
    leerColeccion('clientes'),
    leerColeccion('profesionales'),
    leerColeccion('turnos'),
  ]);
  return { clientes, profesionales, turnos };
};

const escribirDB = async (db) => {
  await Promise.all([
    escribirColeccion('clientes', db.clientes),
    escribirColeccion('profesionales', db.profesionales),
    escribirColeccion('turnos', db.turnos),
  ]);
};

const siguienteId = (coleccion) =>
  coleccion.length ? Math.max(...coleccion.map((x) => x.id)) + 1 : 1;

module.exports = {
  leerDB,
  escribirDB,
  siguienteId,
  leerColeccion,
  escribirColeccion,
};
