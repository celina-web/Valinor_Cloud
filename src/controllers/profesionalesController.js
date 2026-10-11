const JsonHelper = require("../helpers/jsonHelper");
const Profesional = require("../models/Profesional");

const jsonHelper = new JsonHelper("profesionales.json");

// GET ALL / Render Vista
const obtenerProfesionales = (req, res) => {
  const profesionales = jsonHelper.leer();

  if (req.accepts("html")) {
    return res.render("profesionales/index", { profesionales });
  }

  res.json(profesionales);
};

// GET BY ID
const obtenerProfesionalPorId = (req, res) => {
  const profesionales = jsonHelper.leer();
  const id = parseInt(req.params.id);

  const profesional = profesionales.find((p) => p.id === id);

  if (!profesional) {
    return res.status(404).json({ mensaje: "Profesional no encontrado" });
  }

  res.json(profesional);
};

// CREATE (API y Formulario HTML)
const crearProfesional = (req, res) => {
  const profesionales = jsonHelper.leer();
  const { nombre, apellido, especialidad, matricula } = req.body;

  // 1. Validaciones manuales de campos requeridos
  if (!nombre || !apellido || !especialidad || !matricula) {
    const errorMsg = "Los campos Nombre, Apellido, Especialidad y Matrícula son obligatorios.";

    if (req.accepts("html")) {
      return res.status(400).render("profesionales/index", {
        profesionales,
        error: errorMsg,
        formData: req.body,
      });
    }
    return res.status(400).json({ mensaje: errorMsg });
  }

  // 2. Validación manual de duplicado por Matrícula
  const matriculaExiste = profesionales.some(
    (p) => p.matricula.toString().trim() === matricula.toString().trim()
  );
  if (matriculaExiste) {
    const errorMsg = `Ya existe un profesional registrado con la matrícula ${matricula}.`;

    if (req.accepts("html")) {
      return res.status(400).render("profesionales/index", {
        profesionales,
        error: errorMsg,
        formData: req.body,
      });
    }
    return res.status(400).json({ mensaje: errorMsg });
  }

  // Generar ID autoincremental
  const nuevoId = profesionales.length > 0 ? Math.max(...profesionales.map((p) => p.id)) + 1 : 1;
  const nuevoProfesional = new Profesional(
    nuevoId,
    nombre.trim(),
    apellido.trim(),
    especialidad.trim(),
    matricula.trim()
  );

  profesionales.push(nuevoProfesional);
  jsonHelper.guardar(profesionales);

  if (req.accepts("html")) {
    return res.render("profesionales/index", {
      profesionales,
      exito: "Profesional registrado exitosamente.",
    });
  }

  res.status(201).json({
    mensaje: "Profesional creado exitosamente",
    profesional: nuevoProfesional,
  });
};

// UPDATE / PATCH (Soporta API JSON y Formulario HTML)
const actualizarProfesional = (req, res) => {
  const profesionales = jsonHelper.leer();
  const id = parseInt(req.params.id);

  const profesional = profesionales.find((p) => p.id === id);

  if (!profesional) {
    if (req.accepts("html")) {
      return res.status(404).render("profesionales/index", {
        profesionales,
        error: "Profesional no encontrado.",
      });
    }
    return res.status(404).json({ mensaje: "Profesional no encontrado" });
  }

  const { nombre, apellido, especialidad, matricula } = req.body;

  // Validación de matrícula duplicada al actualizar
  if (matricula && matricula.toString().trim() !== profesional.matricula.toString()) {
    const matriculaExiste = profesionales.some(
      (p) => p.matricula.toString().trim() === matricula.toString().trim()
    );
    if (matriculaExiste) {
      const errorMsg = `La matrícula ${matricula} ya pertenece a otro profesional.`;
      if (req.accepts("html")) {
        return res.status(400).render("profesionales/index", {
          profesionales,
          error: errorMsg,
        });
      }
      return res.status(400).json({ mensaje: errorMsg });
    }
  }

  profesional.nombre = nombre ? nombre.trim() : profesional.nombre;
  profesional.apellido = apellido ? apellido.trim() : profesional.apellido;
  profesional.especialidad = especialidad ? especialidad.trim() : profesional.especialidad;
  profesional.matricula = matricula ? matricula.trim() : profesional.matricula;

  jsonHelper.guardar(profesionales);

  if (req.accepts("html")) {
    return res.render("profesionales/index", {
      profesionales,
      exito: "Profesional actualizado exitosamente.",
    });
  }

  res.json({
    mensaje: "Profesional actualizado exitosamente",
    profesional,
  });
};

// DELETE (Soporta API y Vista Pug)
const eliminarProfesional = (req, res) => {
  const profesionales = jsonHelper.leer();
  const id = parseInt(req.params.id);

  const nuevosProfesionales = profesionales.filter((p) => p.id !== id);

  if (profesionales.length === nuevosProfesionales.length) {
    if (req.accepts("html")) {
      return res.status(404).render("profesionales/index", {
        profesionales,
        error: "El profesional a eliminar no fue encontrado.",
      });
    }
    return res.status(404).json({ mensaje: "Profesional no encontrado" });
  }

  jsonHelper.guardar(nuevosProfesionales);

  if (req.accepts("html")) {
    return res.render("profesionales/index", {
      profesionales: nuevosProfesionales,
      exito: "Profesional eliminado exitosamente.",
    });
  }

  res.json({ mensaje: "Profesional eliminado exitosamente" });
};

module.exports = {
  obtenerProfesionales,
  obtenerProfesionalPorId,
  crearProfesional,
  actualizarProfesional,
  eliminarProfesional,
};
