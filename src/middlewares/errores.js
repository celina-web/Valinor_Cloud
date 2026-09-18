const notFound = (req, res) => {
  res.status(404).json({ error: 'Ruta inexistente' });
};

const errorHandler = (err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
};

module.exports = { notFound, errorHandler };
