const JsonHelper = require("../helpers/jsonHelper");
const Cliente = require("../models/Cliente");

const jsonHelper = new JsonHelper("clientes.json");

// GET ALL / Render Vista
const obtenerClientes = (req, res) => {
  const clientes = jsonHelper.leer();

  // Si la petición acepta HTML (navegador) renderiza la vista
  if (req.accepts("html")) {
    return res.render("clientes/index", { clientes });
  }

  // De lo contrario responde JSON para Postman / ThunderClient
  res.json(clientes);
};

// GET BY ID
const obtenerClientePorId = (req, res) => {
  const clientes = jsonHelper.leer();
  const id = parseInt(req.params.id);

  const cliente = clientes.find((c) => c.id === id);

  if (!cliente) {
    return res.status(404).json({ mensaje: "Cliente no encontrado" });
  }

  res.json(cliente);
};

// CREATE (Soporta API y Formulario HTML)
const crearCliente = (req, res) => {
  const clientes = jsonHelper.leer();
  const { nombre, apellido, dni, telefono } = req.body;

  // 1. Validaciones manuales de campos requeridos
  if (!nombre || !apellido || !dni) {
    const errorMsg = "Los campos Nombre, Apellido y DNI son obligatorios.";
    
    if (req.accepts("html")) {
      return res.status(400).render("clientes/index", {
        clientes,
        error: errorMsg,
        formData: req.body,
      });
    }
    return res.status(400).json({ mensaje: errorMsg });
  }

  // 2. Validación manual de duplicado por DNI
  const dniExiste = clientes.some((c) => c.dni.toString().trim() === dni.toString().trim());
  if (dniExiste) {
    const errorMsg = `Ya existe un cliente registrado con el DNI ${dni}.`;
    
    if (req.accepts("html")) {
      return res.status(400).render("clientes/index", {
        clientes,
        error: errorMsg,
        formData: req.body,
      });
    }
    return res.status(400).json({ mensaje: errorMsg });
  }

  // Generar ID autoincremental
  const nuevoId = clientes.length > 0 ? Math.max(...clientes.map((c) => c.id)) + 1 : 1;
  const nuevoCliente = new Cliente(nuevoId, nombre.trim(), apellido.trim(), dni.trim(), telefono ? telefono.trim() : "");

  clientes.push(nuevoCliente);
  jsonHelper.guardar(clientes);

  if (req.accepts("html")) {
    return res.render("clientes/index", {
      clientes,
      exito: "Cliente registrado exitosamente.",
    });
  }

  res.status(201).json({
    mensaje: "Cliente creado exitosamente",
    cliente: nuevoCliente,
  });
};

// UPDATE / PATCH (Soporta API JSON y Formulario HTML)
const actualizarCliente = (req, res) => {
  const clientes = jsonHelper.leer();
  const id = parseInt(req.params.id);

  const cliente = clientes.find((c) => c.id === id);

  if (!cliente) {
    if (req.accepts("html")) {
      return res.status(404).render("clientes/index", {
        clientes,
        error: "Cliente no encontrado.",
      });
    }
    return res.status(404).json({ mensaje: "Cliente no encontrado" });
  }

  const { nombre, apellido, dni, telefono } = req.body;

  // Validación de DNI duplicado al actualizar
  if (dni && dni.toString().trim() !== cliente.dni.toString()) {
    const dniExiste = clientes.some((c) => c.dni.toString().trim() === dni.toString().trim());
    if (dniExiste) {
      const errorMsg = `El DNI ${dni} ya pertenece a otro cliente.`;
      if (req.accepts("html")) {
        return res.status(400).render("clientes/index", {
          clientes,
          error: errorMsg,
        });
      }
      return res.status(400).json({ mensaje: errorMsg });
    }
  }

  cliente.nombre = nombre ? nombre.trim() : cliente.nombre;
  cliente.apellido = apellido ? apellido.trim() : cliente.apellido;
  cliente.dni = dni ? dni.trim() : cliente.dni;
  cliente.telefono = telefono !== undefined ? telefono.trim() : cliente.telefono;

  jsonHelper.guardar(clientes);

  if (req.accepts("html")) {
    return res.render("clientes/index", {
      clientes,
      exito: "Cliente actualizado exitosamente.",
    });
  }

  res.json({
    mensaje: "Cliente actualizado exitosamente",
    cliente,
  });
};

// DELETE (Soporta eliminación desde formulario Pug)
const eliminarCliente = (req, res) => {
  const clientes = jsonHelper.leer();
  const id = parseInt(req.params.id);

  const nuevosClientes = clientes.filter((c) => c.id !== id);

  if (clientes.length === nuevosClientes.length) {
    if (req.accepts("html")) {
      return res.status(404).render("clientes/index", {
        clientes,
        error: "El cliente a eliminar no fue encontrado.",
      });
    }
    return res.status(404).json({ mensaje: "Cliente no encontrado" });
  }

  jsonHelper.guardar(nuevosClientes);

  if (req.accepts("html")) {
    return res.render("clientes/index", {
      clientes: nuevosClientes,
      exito: "Cliente eliminado exitosamente.",
    });
  }

  res.json({ mensaje: "Cliente eliminado exitosamente" });
};

module.exports = {
  obtenerClientes,
  obtenerClientePorId,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
};
