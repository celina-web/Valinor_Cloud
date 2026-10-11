const tablaProfesionales = document.getElementById("tablaProfesionales");
const sinRegistros = document.getElementById("sinRegistros");
const errorListado = document.getElementById("errorListado");
const formAlta = document.getElementById("formAlta");
const errorAlta = document.getElementById("errorAlta");
const modalEditar = document.getElementById("modalEditar");
const formEditar = document.getElementById("formEditar");
const errorEdicion = document.getElementById("errorEdicion");

const abrirEdicion = (profesional) => {
  llenarFormulario(formEditar, profesional);
  mostrarError(errorEdicion, "");
  modalEditar.hidden = false;
};

const eliminarProfesional = async (profesional) => {
  if (!confirm(`¿Eliminar a ${profesional.nombre} ${profesional.apellido}?`)) return;
  try {
    await api(`/api/profesionales/${profesional._id}`, { method: "DELETE" });
    await cargarProfesionales();
  } catch (error) {
    mostrarError(errorListado, error.message);
  }
};

const crearFilaProfesional = (profesional) => {
  const acciones = [];
  if (puede("profesionales:update")) {
    acciones.push(crearBoton("Editar", "btn-editar", () => abrirEdicion(profesional)));
  }
  if (puede("profesionales:delete")) {
    acciones.push(crearBoton("Eliminar", "btn-danger", () => eliminarProfesional(profesional)));
  }
  return crearFila(
    [profesional.nombre, profesional.apellido, profesional.especialidad, profesional.matricula],
    acciones
  );
};

const cargarProfesionales = async () => {
  try {
    const profesionales = await api("/api/profesionales");
    tablaProfesionales.replaceChildren(...profesionales.map(crearFilaProfesional));
    sinRegistros.hidden = profesionales.length > 0;
    mostrarError(errorListado, "");
  } catch (error) {
    mostrarError(errorListado, error.message);
  }
};

if (formAlta) {
  formAlta.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mostrarError(errorAlta, "");
    try {
      await api("/api/profesionales", { method: "POST", body: leerFormulario(formAlta) });
      formAlta.reset();
      await cargarProfesionales();
    } catch (error) {
      mostrarError(errorAlta, error.message);
    }
  });
}

formEditar.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const { _id, ...datos } = leerFormulario(formEditar);
  try {
    await api(`/api/profesionales/${_id}`, { method: "PUT", body: datos });
    modalEditar.hidden = true;
    await cargarProfesionales();
  } catch (error) {
    mostrarError(errorEdicion, error.message);
  }
});

configurarModal(modalEditar);
cargarProfesionales();
