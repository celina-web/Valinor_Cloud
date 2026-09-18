const { leerDB } = require('../data/db');
const Cliente = require('../models/Cliente');
const Profesional = require('../models/Profesional');

const home = (req, res) => {
  res.render('base', { titulo: 'Inicio' });
};

const listaClientes = async (req, res, next) => {
  try {
    const db = await leerDB();
    res.render('clientes', { titulo: 'Clientes', clientes: db.clientes });
  } catch (err) {
    next(err);
  }
};

const listaProfesionales = async (req, res, next) => {
  try {
    const db = await leerDB();
    res.render('profesionales', {
      titulo: 'Profesionales',
      profesionales: db.profesionales,
    });
  } catch (err) {
    next(err);
  }
};

const listaTurnos = async (req, res, next) => {
  try {
    const db = await leerDB();

    const turnos = db.turnos.map((turno) => {
      const cli = db.clientes.find((c) => c.id === turno.idCliente);
      const prof = db.profesionales.find((p) => p.id === turno.idProfesional);
      return {
        ...turno,
        cliente: cli ? new Cliente(cli).nombreCompleto() : `#${turno.idCliente}`,
        profesional: prof
          ? new Profesional(prof).nombreCompleto()
          : `#${turno.idProfesional}`,
      };
    });

    res.render('turnos', { titulo: 'Turnos', turnos });
  } catch (err) {
    next(err);
  }
};

module.exports = { home, listaClientes, listaProfesionales, listaTurnos };
