const cambiarEstadoTurno = async (turno, estado) => {
  const accion = estado === "atendido" ? "marcar como atendido" : "cancelar";
  if (!confirm(`¿Seguro que querés ${accion} el turno del ${turno.fecha} a las ${turno.hora}?`)) {
    return false;
  }
  await api(`/api/turnos/${turno._id}/estado`, { method: "PATCH", body: { estado } });
  return true;
};

const eliminarTurno = async (turno) => {
  if (!confirm(`¿Eliminar definitivamente el turno del ${turno.fecha} a las ${turno.hora}?`)) {
    return false;
  }
  await api(`/api/turnos/${turno._id}`, { method: "DELETE" });
  return true;
};

const crearFilaTurno = (turno, alTerminar, alFallar) => {
  const ejecutar = (operacion) => async () => {
    try {
      if (await operacion()) await alTerminar();
    } catch (error) {
      alFallar(error.message);
    }
  };

  const acciones = [];
  if (turno.estado === "reservado" && puede("turnos:update")) {
    acciones.push(
      crearBoton("Atender", "btn-atender", ejecutar(() => cambiarEstadoTurno(turno, "atendido")))
    );
    if (rolActual !== "profesional") {
      acciones.push(
        crearBoton("Cancelar", "btn-cancelar", ejecutar(() => cambiarEstadoTurno(turno, "cancelado")))
      );
    }
  }
  if (turno.estado === "cancelado" && puede("turnos:delete")) {
    acciones.push(crearBoton("Eliminar", "btn-danger", ejecutar(() => eliminarTurno(turno))));
  }

  return crearFila(
    [
      turno.fecha,
      turno.hora,
      nombreCompleto(turno.cliente),
      nombreCompleto(turno.profesional),
      crearEtiqueta(turno.estado, `estado-${turno.estado}`),
    ],
    acciones
  );
};
