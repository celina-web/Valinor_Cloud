const tomarCampos = (body = {}, permitidos) => {
  const datos = {};
  permitidos.forEach((campo) => {
    if (body[campo] !== undefined) datos[campo] = body[campo];
  });
  return datos;
};

const describirCambios = (documento) => documento.modifiedPaths().join(", ") || "sin cambios";

module.exports = { tomarCampos, describirCambios };
