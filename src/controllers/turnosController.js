const { leerDB, escribirDB, siguienteId } = require('../data/db');
const Turno = require('../models/Turno');

const ESTADOS_VALIDOS = ['reservado', 'cancelado', 'atendido'];

const turnosActivos = (turnos) => turnos.filter((t) => t.estado !== 'cancelado');

const profesionalOcupado = (turnos, idProfesional, fecha, hora, excluirId = null) =>
  turnosActivos(turnos).some(
    (t) =>
      t.id !== excluirId &&
      t.idProfesional === idProfesional &&
      t.fecha === fecha &&
      t.hora === hora
  );

const clienteOcupado = (turnos, idCliente, fecha, hora, excluirId = null) =>
  turnosActivos(turnos).some(
    (t) =>
      t.id !== excluirId &&
      t.idCliente === idCliente &&
      t.fecha === fecha &&
      t.hora === hora
  );

const obtenerTurnos = async (req, res) => {
  try {
    const db = await leerDB();
    res.json(db.turnos);
  } catch (err) {
    console.error('Error al leer el archivo:', err);
    res.status(500).json({ error: 'Error al leer el archivo' });
  }
};

const obtenerTurnoPorId = async (req, res) => {
  try {
    const db = await leerDB();
    const turno = db.turnos.find((t) => t.id === parseInt(req.params.id));

    if (!turno) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    res.json(turno);
  } catch (err) {
    console.error('Error al leer el archivo:', err);
    res.status(500).json({ error: 'Error al leer el archivo' });
  }
};

const crearTurno = async (req, res) => {
  try {
    const db = await leerDB();

    const { idCliente, idProfesional, fecha, hora, precio } = req.body;

    // 1. Datos mínimos
    if (!idCliente || !idProfesional || !fecha || !hora) {
      return res.status(400).json({
        error: 'idCliente, idProfesional, fecha y hora son obligatorios',
      });
    }

    // 2. Existen cliente y profesional
    const clienteExiste = db.clientes.some((c) => c.id === idCliente);
    if (!clienteExiste) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const profesionalExiste = db.profesionales.some((p) => p.id === idProfesional);
    if (!profesionalExiste) {
      return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    // 3. Regla: profesional libre en ese horario
    if (profesionalOcupado(db.turnos, idProfesional, fecha, hora)) {
      return res.status(409).json({
        error: 'El profesional ya tiene un turno en ese horario',
      });
    }

    // 4. Regla: cliente sin otro turno en el mismo horario
    if (clienteOcupado(db.turnos, idCliente, fecha, hora)) {
      return res.status(409).json({
        error: 'El cliente ya tiene un turno en ese horario',
      });
    }

    // 5. Construir turno
    const ahora = new Date().toISOString();
    const nuevoTurno = new Turno({
      id: siguienteId(db.turnos),
      idCliente,
      idProfesional,
      fecha,
      hora,
      estado: 'reservado',
      precio: precio ?? 0,
      fechaCreacion: ahora,
      fechaModificacion: ahora,
    });

    db.turnos.push(nuevoTurno);

    await escribirDB(db);
    res.status(201).json(nuevoTurno);
  } catch (err) {
    console.error('Error al crear turno:', err);
    res.status(400).json({ error: err.message });
  }
};

// ---------- PUT /turnos/:id ----------
const actualizarTurno = async (req, res) => {
  try {
    const db = await leerDB();
    const id = parseInt(req.params.id);
    const index = db.turnos.findIndex((t) => t.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    const turnoActual = db.turnos[index];

    if (turnoActual.estado === 'cancelado') {
      return res.status(409).json({ error: 'No se puede modificar un turno cancelado' });
    }

    const { fecha, hora, precio } = req.body;

    const nuevaFecha = fecha ?? turnoActual.fecha;
    const nuevaHora = hora ?? turnoActual.hora;

    // Revalidar si cambia fecha/hora
    if (nuevaFecha !== turnoActual.fecha || nuevaHora !== turnoActual.hora) {
      if (
        profesionalOcupado(
          db.turnos,
          turnoActual.idProfesional,
          nuevaFecha,
          nuevaHora,
          id
        )
      ) {
        return res.status(409).json({
          error: 'El profesional ya tiene un turno en ese horario',
        });
      }

      if (clienteOcupado(db.turnos, turnoActual.idCliente, nuevaFecha, nuevaHora, id)) {
        return res.status(409).json({
          error: 'El cliente ya tiene un turno en ese horario',
        });
      }
    }

    db.turnos[index] = {
      ...turnoActual,
      fecha: nuevaFecha,
      hora: nuevaHora,
      precio: precio ?? turnoActual.precio,
      fechaModificacion: new Date().toISOString(),
    };

    await escribirDB(db);
    res.json(db.turnos[index]);
  } catch (err) {
    console.error('Error al actualizar turno:', err);
    res.status(400).json({ error: err.message });
  }
};

const cambiarEstadoTurno = async (req, res) => {
  try {
    const db = await leerDB();
    const id = parseInt(req.params.id);
    const index = db.turnos.findIndex((t) => t.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    const { estado } = req.body;

    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`,
      });
    }

    const turno = db.turnos[index];

    const transiciones = {
      reservado: ['cancelado', 'atendido'],
      atendido: [],
      cancelado: [],
    };

    if (!transiciones[turno.estado].includes(estado)) {
      return res.status(409).json({
        error: `No se puede pasar de "${turno.estado}" a "${estado}"`,
      });
    }

    db.turnos[index] = {
      ...turno,
      estado,
      fechaModificacion: new Date().toISOString(),
    };

    await escribirDB(db);
    res.json(db.turnos[index]);
  } catch (err) {
    console.error('Error al cambiar estado:', err);
    res.status(400).json({ error: err.message });
  }
};

const eliminarTurno = async (req, res) => {
  try {
    const db = await leerDB();
    const id = parseInt(req.params.id);
    const index = db.turnos.findIndex((t) => t.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    if (db.turnos[index].estado !== 'cancelado') {
      return res.status(409).json({
        error: 'Solo se pueden eliminar turnos cancelados. Cancelalo primero.',
      });
    }

    db.turnos.splice(index, 1);

    await escribirDB(db);
    res.json({ message: 'Turno eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar turno:', err);
    res.status(500).json({ error: 'Error al eliminar el turno' });
  }
};

module.exports = {
  obtenerTurnos,
  obtenerTurnoPorId,
  crearTurno,
  actualizarTurno,
  cambiarEstadoTurno,
  eliminarTurno,
};