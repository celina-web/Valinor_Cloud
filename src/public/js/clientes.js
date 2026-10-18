const tablaClientes = document.getElementById("tablaClientes");
const sinRegistros = document.getElementById("sinRegistros");
const errorListado = document.getElementById("errorListado");
const formAlta = document.getElementById("formAlta");
const errorAlta = document.getElementById("errorAlta");
const modalEditar = document.getElementById("modalEditar");
const formEditar = document.getElementById("formEditar");
const errorEdicion = document.getElementById("errorEdicion");

const abrirEdicion = (cliente) => {
  llenarFormulario(formEditar, cliente);
  mostrarError(errorEdicion, "");
  modalEditar.hidden = false;
};

const eliminarCliente = async (cliente) => {
  if (!confirm(`¿Eliminar a ${cliente.nombre} ${cliente.apellido}?`)) return;
  try {
    await api(`/api/clientes/${cliente._id}`, { method: "DELETE" });
    await cargarClientes();
  } catch (error) {
    mostrarError(errorListado, error.message);
  }
};

const crearFilaCliente = (cliente) => {
  const acciones = [];
  if (puede("clientes:update")) {
    acciones.push(crearBoton("Editar", "btn-editar", () => abrirEdicion(cliente)));
  }
  if (puede("clientes:delete")) {
    acciones.push(crearBoton("Eliminar", "btn-danger", () => eliminarCliente(cliente)));
  }
  return crearFila(
    [cliente.nombre, cliente.apellido, cliente.dni, cliente.telefono, cliente.email],
    acciones
  );
};

const cargarClientes = async () => {
  try {
    const clientes = await api("/api/clientes");
    tablaClientes.replaceChildren(...clientes.map(crearFilaCliente));
    sinRegistros.hidden = clientes.length > 0;
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
      await api("/api/clientes", { method: "POST", body: leerFormulario(formAlta) });
      formAlta.reset();
      await cargarClientes();
    } catch (error) {
      mostrarError(errorAlta, error.message);
    }
  });
}

formEditar.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const { _id, ...datos } = leerFormulario(formEditar);
  try {
    await api(`/api/clientes/${_id}`, { method: "PUT", body: datos });
    modalEditar.hidden = true;
    await cargarClientes();
  } catch (error) {
    mostrarError(errorEdicion, error.message);
  }
});

configurarModal(modalEditar);
cargarClientes();
