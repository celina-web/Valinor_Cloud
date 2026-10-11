const tablaTurnos = document.getElementById("tablaTurnos");
const sinTurnos = document.getElementById("sinTurnos");
const errorTurnos = document.getElementById("errorTurnos");

const fechaDeHoy = () => {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
};

const actualizarResumen = (turnos) => {
  const contar = (estado) => turnos.filter((turno) => turno.estado === estado).length;
  document.getElementById("cantidadReservados").textContent = contar("reservado");
  document.getElementById("cantidadAtendidos").textContent = contar("atendido");
  document.getElementById("cantidadCancelados").textContent = contar("cancelado");
};

const cargarTurnosDeHoy = async () => {
  try {
    const turnos = await api(`/api/turnos?fecha=${fechaDeHoy()}`);
    tablaTurnos.replaceChildren(
      ...turnos.map((turno) =>
        crearFilaTurno(turno, cargarTurnosDeHoy, (mensaje) => mostrarError(errorTurnos, mensaje))
      )
    );
    sinTurnos.hidden = turnos.length > 0;
    actualizarResumen(turnos);
    mostrarError(errorTurnos, "");
  } catch (error) {
    mostrarError(errorTurnos, error.message);
  }
};

cargarTurnosDeHoy();
