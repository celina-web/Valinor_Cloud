const cambiarEstadoTurno = async (turno, estado) => {
  const atender = estado === "atendido";
  const confirmado = await confirmar(
    atender
      ? {
          titulo: "Marcar turno como atendido",
          mensaje: `¿Seguro que querés marcar como atendido el turno del ${turno.fecha} a las ${turno.hora}?`,
          textoConfirmar: "Marcar como atendido",
          variante: "exito",
        }
      : {
          titulo: "Cancelar turno",
          mensaje: `¿Seguro que querés cancelar el turno del ${turno.fecha} a las ${turno.hora}? Esta acción no se puede deshacer.`,
          textoConfirmar: "Cancelar turno",
          textoCancelar: "Volver",
          variante: "peligro",
        }
  );
  if (!confirmado) return false;
  await api(`/api/turnos/${turno._id}/estado`, { method: "PATCH", body: { estado } });
  return true;
};

const eliminarTurno = async (turno) => {
  const confirmado = await confirmar({
    titulo: "Eliminar turno",
    mensaje: `¿Eliminar definitivamente el turno del ${turno.fecha} a las ${turno.hora}? Esta acción no se puede deshacer.`,
    textoConfirmar: "Eliminar",
    variante: "peligro",
  });
  if (!confirmado) return false;
  await api(`/api/turnos/${turno._id}`, { method: "DELETE" });
  return true;
};

// Nombre del cliente siempre en texto oscuro y resaltado, sea cual sea el estado del turno.
const textoDestacado = (texto) => {
  const elemento = document.createElement("span");
  elemento.className = "font-medium text-gray-900";
  elemento.textContent = texto;
  return elemento;
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

  const fila = crearFila(
    [
      turno.fecha,
      turno.hora,
      textoDestacado(nombreCompleto(turno.cliente)),
      nombreCompleto(turno.profesional),
      crearEtiqueta(turno.estado, `estado-${turno.estado}`),
    ],
    acciones
  );
  // Franja de color según el estado (clases fila-* definidas en includes/tema.pug).
  fila.classList.add(`fila-${turno.estado}`);
  return fila;
};
