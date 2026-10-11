const tablaAuditoria = document.getElementById("tablaAuditoria");
const sinRegistros = document.getElementById("sinRegistros");
const errorAuditoria = document.getElementById("errorAuditoria");
const formFiltros = document.getElementById("formFiltros");

const claseDeAccion = (accion) => {
  if (["ACCESO_DENEGADO", "LOGIN_FALLIDO", "SESION_REVOCADA"].includes(accion)) {
    return "estado-cancelado";
  }
  if (["LOGIN", "LOGOUT"].includes(accion)) return "estado-reservado";
  return "estado-atendido";
};

const cargarAuditoria = async () => {
  const filtros = new URLSearchParams();
  Object.entries(leerFormulario(formFiltros)).forEach(([clave, valor]) => {
    if (valor) filtros.append(clave, valor);
  });

  try {
    const registros = await api(`/api/auditoria?${filtros}`);
    tablaAuditoria.replaceChildren(
      ...registros.map((registro) =>
        crearFila(
          [
            formatearFechaHora(registro.createdAt),
            registro.usuarioNombre,
            crearEtiqueta(registro.accion, claseDeAccion(registro.accion)),
            registro.entidad,
            registro.detalle,
            registro.ip,
          ],
          null
        )
      )
    );
    sinRegistros.hidden = registros.length > 0;
    mostrarError(errorAuditoria, "");
  } catch (error) {
    mostrarError(errorAuditoria, error.message);
  }
};

formFiltros.addEventListener("submit", (evento) => {
  evento.preventDefault();
  cargarAuditoria();
});

cargarAuditoria();
