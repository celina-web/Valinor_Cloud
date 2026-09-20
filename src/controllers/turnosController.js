const JsonHelper = require("../helpers/jsonHelper");
const Turno = require("../models/Turno");

const jsonTurnos = new JsonHelper("turnos.json");
const jsonClientes = new JsonHelper("clientes.json");
const jsonProfesionales = new JsonHelper("profesionales.json");

// Helper para poblar datos de Clientes y Profesionales en el listado de turnos
const enriquecerTurnos = (turnos, clientes, profesionales) => {
  return turnos.map((t) => {
    const cliente = clientes.find((c) => c.id === t.clienteId);
    const profesional = profesionales.find((p) => p.id === t.profesionalId);

    return {
      ...t,
      clienteNombre: cliente ? `${cliente.nombre} ${cliente.apellido}` : "Cliente No Encontrado",
      profesionalNombre: profesional ? `${profesional.nombre} ${profesional.apellido}` : "Profesional No Encontrado",
    };
  });
};

// GET ALL / Render Vista
const obtenerTurnos = (req, res) => {
  const turnos = jsonTurnos.leer();
  const clientes = jsonClientes.leer();
  const profesionales = jsonProfesionales.leer();

  let turnosFiltrados = turnos;
  const { estado, clienteId, profesionalId, fecha} = req.query;

  if (estado) turnosFiltrados = turnosFiltrados.filter((t) => t.estado === estado);
  if (clienteId) turnosFiltrados = turnosFiltrados.filter((t) => t.clienteId === parseInt(clienteId));
  if (profesionalId) turnosFiltrados = turnosFiltrados.filter((t) => t.profesionalId === parseInt(profesionalId));
  if (fecha) turnosFiltrados = turnosFiltrados.filter((t) => t.fecha === fecha);

  const turnosEnriquecidos = enriquecerTurnos(turnosFiltrados, clientes, profesionales);

  if (req.accepts("html")) {
    return res.render("turnos/index", {
      turnos: turnosEnriquecidos,
      clientes,
      profesionales,
    });
  }

  res.json(turnosEnriquecidos);
};

// GET BY ID
const obtenerTurnoPorId = (req, res) => {
  const turnos = jsonTurnos.leer();
  const id = parseInt(req.params.id);

  const turno = turnos.find((t) => t.id === id);

  if (!turno) {
    return res.status(404).json({ mensaje: "Turno no encontrado" });
  }

  res.json(turno);
};

// CREATE (Con todas las reglas de negocio integradas)
const crearTurno = (req, res) => {
  const turnos = jsonTurnos.leer();
  const clientes = jsonClientes.leer();
  const profesionales = jsonProfesionales.leer();

  const { clienteId, profesionalId, fecha, hora } = req.body;

  const cId = parseInt(clienteId);
  const pId = parseInt(profesionalId);

  // Helper para responder con error (render o JSON)
  const responderError = (mensaje, status = 400) => {
    if (req.accepts("html")) {
      const turnosEnriquecidos = enriquecerTurnos(turnos, clientes, profesionales);
      return res.status(status).render("turnos/index", {
        turnos: turnosEnriquecidos,
        clientes,
        profesionales,
        error: mensaje,
        formData: req.body,
      });
    }
    return res.status(status).json({ mensaje });
  };

  // 1. Campos obligatorios
  if (!clienteId || !profesionalId || !fecha || !hora) {
    return responderError("Todos los campos (Cliente, Profesional, Fecha y Hora) son obligatorios.");
  }

  // 2. Validación de existencia del Cliente
  const clienteExiste = clientes.some((c) => c.id === cId);
  if (!clienteExiste) {
    return responderError("El cliente seleccionado no existe.");
  }

  // 3. Validación de existencia del Profesional
  const profesionalExiste = profesionales.some((p) => p.id === pId);
  if (!profesionalExiste) {
    return responderError("El profesional seleccionado no existe.");
  }

  // 4. Regla de Negocio: Superposición horaria del Profesional (en turnos activos)
  const profesionalOcupado = turnos.some(
    (t) => t.profesionalId === pId && t.fecha === fecha && t.hora === hora && t.estado === "reservado"
  );
  if (profesionalOcupado) {
    return responderError("El profesional ya tiene un turno reservado en esa misma fecha y hora.");
  }

  // 5. Regla de Negocio: Duplicidad del Cliente (en turnos activos)
  const clienteOcupado = turnos.some(
    (t) => t.clienteId === cId && t.fecha === fecha && t.hora === hora && t.estado === "reservado"
  );
  if (clienteOcupado) {
    return responderError("El cliente ya tiene un turno reservado en esa misma fecha y hora.");
  }

  // 6. Validación de formato de fecha y hora
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)){
    return responderError("La fecha debe tener el formato YYYY-MM-DD.");
  }

  if (!/^\d{2}:\d{2}$/.test(hora)){
  return responderError("La hora debe tener el formato HH:mm.");
  }

  // Generar ID autoincremental y guardar
  const nuevoId = turnos.length > 0 ? Math.max(...turnos.map((t) => t.id)) + 1 : 1;
  const nuevoTurno = new Turno(nuevoId, cId, pId, fecha, hora, "reservado");

  turnos.push(nuevoTurno);
  jsonTurnos.guardar(turnos);

  if (req.accepts("html")) {
    const turnosEnriquecidos = enriquecerTurnos(turnos, clientes, profesionales);
    return res.render("turnos/index", {
      turnos: turnosEnriquecidos,
      clientes,
      profesionales,
      exito: "Turno reservado exitosamente.",
    });
  }

  res.status(201).json({
    mensaje: "Turno creado exitosamente",
    turno: nuevoTurno,
  });
};

// CAMBIAR ESTADO (reservado -> atendido / cancelado)
const cambiarEstadoTurno = (req, res) => {
  const turnos = jsonTurnos.leer();
  const id = parseInt(req.params.id);
  const { estado } = req.body;

  const estadosValidos = ["reservado", "atendido", "cancelado"];

  if (!estado || !estadosValidos.includes(estado)) {
    return res.status(400).json({ mensaje: "Estado no válido. Use: reservado, atendido o cancelado." });
  }

  const turno = turnos.find((t) => t.id === id);

  if (!turno) {
    return res.status(404).json({ mensaje: "Turno no encontrado" });
  }

  if (turno.estado != "reservado"){
    return res.status(400).json({mensaje: `El turno ya está en estado "${turno.estado}" y no puede modificarse.`});
  }

  turno.estado = estado;
  jsonTurnos.guardar(turnos);

  if (req.accepts("html")) {
    const clientes = jsonClientes.leer();
    const profesionales = jsonProfesionales.leer();
    const turnosEnriquecidos = enriquecerTurnos(turnos, clientes, profesionales);

    return res.render("turnos/index", {
      turnos: turnosEnriquecidos,
      clientes,
      profesionales,
      exito: `El estado del turno #${id} fue cambiado a "${estado}".`,
    });
  }

  res.json({
    mensaje: `Estado del turno actualizado a ${estado}`,
    turno,
  });
};

// DELETE
const eliminarTurno = (req, res) => {
  const turnos = jsonTurnos.leer();
  const id = parseInt(req.params.id);

  const turno = turnos.find((t) => t.id === id);

  if (!turno) {
    return res.status(404).json({mensaje: "Turno no encontrado."});
  }

  if (turno.estado !== "cancelado") {
    return res.status(400).json({ mensaje: "Solo se pueden eliminar turnos cancelados." });
  }

  const nuevosTurnos = turnos.filter((t) => t.id !== id);
  jsonTurnos.guardar(nuevosTurnos);

  res.json({ mensaje: "Turno eliminado exitosamente" });
};

module.exports = {
  obtenerTurnos,
  obtenerTurnoPorId,
  crearTurno,
  cambiarEstadoTurno,
  eliminarTurno,
};
