const Cliente = require('../models/Cliente');
const Profesional = require('../models/Profesional');

// valida el body de un cliente antes de llegar al controller.
const validarCliente = (req, res, next) => {
  const errores = Cliente.validar(req.body);
  if (errores.length) {
    return res.status(400).json({ errores });
  }
  next();
};

// valida el body de un profesional.
const validarProfesional = (req, res, next) => {
  const errores = Profesional.validar(req.body);
  if (errores.length) {
    return res.status(400).json({ errores });
  }
  next();
};

// valida los campos obligatorios de un turno.
const validarTurno = (req, res, next) => {
  const { idCliente, idProfesional, fecha, hora } = req.body;
  const errores = [];
  if (!idCliente) errores.push('idCliente es obligatorio');
  if (!idProfesional) errores.push('idProfesional es obligatorio');
  if (!fecha) errores.push('fecha es obligatoria');
  if (!hora) errores.push('hora es obligatoria');

  if (errores.length) {
    return res.status(400).json({ errores });
  }
  next();
};

module.exports = { validarCliente, validarProfesional, validarTurno };
