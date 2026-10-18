const tablaUsuarios = document.getElementById("tablaUsuarios");
const errorListado = document.getElementById("errorListado");
const formAlta = document.getElementById("formAlta");
const errorAlta = document.getElementById("errorAlta");
const modalEditar = document.getElementById("modalEditar");
const formEditar = document.getElementById("formEditar");
const errorEdicion = document.getElementById("errorEdicion");

const aFechaLocal = (valor) => {
  if (!valor) return "";
  const fecha = new Date(valor);
  fecha.setMinutes(fecha.getMinutes() - fecha.getTimezoneOffset());
  return fecha.toISOString().slice(0, 16);
};

const aFechaIso = (valor) => (valor ? new Date(valor).toISOString() : "");

const prepararDatos = (formulario) => {
  const datos = leerFormulario(formulario);
  datos.expiraEl = aFechaIso(datos.expiraEl);
  return datos;
};

const sincronizarProfesional = (formulario) => {
  const esProfesional = formulario.rol.value === "profesional";
  const esCliente = formulario.rol.value === "cliente";
  formulario.profesional.disabled = !esProfesional;
  formulario.profesional.required = esProfesional;
  formulario.cliente.disabled = !esCliente;
  formulario.cliente.required = esCliente;
  if (!esProfesional) formulario.profesional.value = "";
  if (!esCliente) formulario.cliente.value = "";
};

const estadoDe = (usuario) => {
  const vencido = usuario.expiraEl && new Date(usuario.expiraEl) <= new Date();
  if (!usuario.activo) return crearEtiqueta("inactivo", "estado-cancelado");
  if (vencido) return crearEtiqueta("vencido", "estado-cancelado");
  return crearEtiqueta("activo", "estado-atendido");
};

const abrirEdicion = (usuario) => {
  llenarFormulario(formEditar, {
    ...usuario,
    password: "",
    profesional: usuario.profesional ? usuario.profesional._id : "",
    cliente: usuario.cliente ? usuario.cliente._id : "",
    expiraEl: aFechaLocal(usuario.expiraEl),
  });
  sincronizarProfesional(formEditar);
  mostrarError(errorEdicion, "");
  modalEditar.hidden = false;
};

const cambiarActivo = async (usuario) => {
  try {
    await api(`/api/usuarios/${usuario._id}`, { method: "PUT", body: { activo: !usuario.activo } });
    await cargarUsuarios();
  } catch (error) {
    mostrarError(errorListado, error.message);
  }
};

const eliminarUsuario = async (usuario) => {
  if (!confirm(`¿Eliminar el usuario ${usuario.usuario}?`)) return;
  try {
    await api(`/api/usuarios/${usuario._id}`, { method: "DELETE" });
    await cargarUsuarios();
  } catch (error) {
    mostrarError(errorListado, error.message);
  }
};

const crearFilaUsuario = (usuario) => {
  const esElMismo = usuario._id === idUsuarioActual;
  const acciones = [];
  if (puede("usuarios:update")) {
    acciones.push(crearBoton("Editar", "btn-editar", () => abrirEdicion(usuario)));
    if (!esElMismo) {
      acciones.push(
        crearBoton(usuario.activo ? "Desactivar" : "Activar", "btn-secundario", () =>
          cambiarActivo(usuario)
        )
      );
    }
  }
  if (puede("usuarios:delete") && !esElMismo) {
    acciones.push(crearBoton("Eliminar", "btn-danger", () => eliminarUsuario(usuario)));
  }

  return crearFila(
    [
      usuario.usuario,
      usuario.nombre,
      usuario.rol,
      usuario.profesional ? nombreCompleto(usuario.profesional) : "-",
      usuario.cliente ? nombreCompleto(usuario.cliente) : "-",
      estadoDe(usuario),
      formatearFechaHora(usuario.expiraEl),
      formatearFechaHora(usuario.createdAt),
      formatearFechaHora(usuario.updatedAt),
      formatearFechaHora(usuario.ultimoAcceso),
    ],
    acciones
  );
};

const cargarUsuarios = async () => {
  try {
    const usuarios = await api("/api/usuarios");
    tablaUsuarios.replaceChildren(...usuarios.map(crearFilaUsuario));
    mostrarError(errorListado, "");
  } catch (error) {
    mostrarError(errorListado, error.message);
  }
};

const cargarProfesionales = async () => {
  const profesionales = await api("/api/profesionales");
  document.querySelectorAll(".select-profesional").forEach((select) => {
    llenarSelect(select, profesionales, (p) => `${p.apellido}, ${p.nombre}`);
  });
};

const cargarClientes = async () => {
  const clientes = await api("/api/clientes");
  document.querySelectorAll(".select-cliente").forEach((select) => {
    llenarSelect(select, clientes, (cliente) => `${cliente.apellido}, ${cliente.nombre}`);
  });
};

[formAlta, formEditar].filter(Boolean).forEach((formulario) => {
  formulario.rol.addEventListener("change", () => sincronizarProfesional(formulario));
  sincronizarProfesional(formulario);
});

if (formAlta) {
  formAlta.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mostrarError(errorAlta, "");
    try {
      await api("/api/usuarios", { method: "POST", body: prepararDatos(formAlta) });
      formAlta.reset();
      sincronizarProfesional(formAlta);
      await cargarUsuarios();
    } catch (error) {
      mostrarError(errorAlta, error.message);
    }
  });
}

formEditar.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const { _id, ...datos } = prepararDatos(formEditar);
  try {
    await api(`/api/usuarios/${_id}`, { method: "PUT", body: datos });
    modalEditar.hidden = true;
    await cargarUsuarios();
  } catch (error) {
    mostrarError(errorEdicion, error.message);
  }
});

configurarModal(modalEditar);
cargarProfesionales()
  .then(cargarClientes)
  .then(cargarUsuarios)
  .catch((error) => mostrarError(errorListado, error.message));
