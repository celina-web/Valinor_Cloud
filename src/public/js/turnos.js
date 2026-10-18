const tablaTurnos = document.getElementById("tablaTurnos");
const sinTurnos = document.getElementById("sinTurnos");
const errorTurnos = document.getElementById("errorTurnos");
const formAlta = document.getElementById("formAlta");
const errorAlta = document.getElementById("errorAlta");
const formFiltros = document.getElementById("formFiltros");

const mostrarErrorTurnos = (mensaje) => mostrarError(errorTurnos, mensaje);

const cargarTurnos = async () => {
  const filtros = new URLSearchParams();
  Object.entries(leerFormulario(formFiltros)).forEach(([clave, valor]) => {
    if (valor) filtros.append(clave, valor);
  });

  try {
    const turnos = await api(`/api/turnos?${filtros}`);
    tablaTurnos.replaceChildren(
      ...turnos.map((turno) => crearFilaTurno(turno, cargarTurnos, mostrarErrorTurnos))
    );
    sinTurnos.hidden = turnos.length > 0;
    mostrarErrorTurnos("");
  } catch (error) {
    mostrarErrorTurnos(error.message);
  }
};

const cargarOpcionesAlta = async () => {
  const [clientes, profesionales] = await Promise.all([
    api("/api/clientes"),
    api("/api/profesionales"),
  ]);
  llenarSelect(formAlta.cliente, clientes, (c) => `${c.apellido}, ${c.nombre} (DNI ${c.dni})`);
  llenarSelect(
    formAlta.profesional,
    profesionales,
    (p) => `${p.apellido}, ${p.nombre} - ${p.especialidad}`
  );
};

if (formAlta) {
  formAlta.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mostrarError(errorAlta, "");
    try {
      await api("/api/turnos", { method: "POST", body: leerFormulario(formAlta) });
      formAlta.fecha.value = "";
      formAlta.hora.value = "";
      await cargarTurnos();
    } catch (error) {
      mostrarError(errorAlta, error.message);
    }
  });

  cargarOpcionesAlta().catch((error) => mostrarError(errorAlta, error.message));
}

formFiltros.addEventListener("change", cargarTurnos);
document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
  formFiltros.reset();
  cargarTurnos();
});

cargarTurnos();
