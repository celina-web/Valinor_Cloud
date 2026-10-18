const api = async (url, opciones = {}) => {
  const respuesta = await fetch(url, {
    method: opciones.method || "GET",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });

  if (respuesta.status === 401 && location.pathname !== "/login") {
    location.href = "/login";
    throw new Error("Tu sesión terminó");
  }
  if (respuesta.status === 204) return null;

  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || "Ocurrió un error inesperado");
  return datos;
};

const permisos = JSON.parse(document.body.dataset.permisos || "[]");
const rolActual = document.body.dataset.rol;
const idUsuarioActual = document.body.dataset.usuarioId;

const puede = (permiso) => permisos.includes(permiso);

const mostrarError = (elemento, mensaje) => {
  if (!elemento) return;
  elemento.textContent = mensaje || "";
  elemento.hidden = !mensaje;
};

const leerFormulario = (formulario) => {
  const datos = Object.fromEntries(new FormData(formulario));
  formulario.querySelectorAll("input[type=checkbox]").forEach((casilla) => {
    datos[casilla.name] = casilla.checked;
  });
  return datos;
};

const llenarFormulario = (formulario, datos) => {
  Array.from(formulario.elements).forEach((campo) => {
    if (!campo.name) return;
    const valor = datos[campo.name];
    if (campo.type === "checkbox") campo.checked = Boolean(valor);
    else campo.value = valor ?? "";
  });
};

const crearBoton = (texto, clase, alHacerClick) => {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.textContent = texto;
  if (clase) boton.className = clase;
  boton.addEventListener("click", alHacerClick);
  return boton;
};

const crearFila = (valores, acciones = []) => {
  const fila = document.createElement("tr");
  valores.forEach((valor) => {
    const celda = document.createElement("td");
    if (valor instanceof Node) celda.appendChild(valor);
    else celda.textContent = valor === undefined || valor === null || valor === "" ? "-" : valor;
    fila.appendChild(celda);
  });
  if (acciones !== null) {
    const celdaAcciones = document.createElement("td");
    celdaAcciones.className = "acciones";
    acciones.forEach((boton) => celdaAcciones.appendChild(boton));
    fila.appendChild(celdaAcciones);
  }
  return fila;
};

const crearEtiqueta = (texto, clase) => {
  const etiqueta = document.createElement("span");
  etiqueta.className = `etiqueta ${clase}`;
  etiqueta.textContent = texto;
  return etiqueta;
};

const nombreCompleto = (persona) => (persona ? `${persona.apellido}, ${persona.nombre}` : "(eliminado)");

const formatearFechaHora = (valor) =>
  valor
    ? new Date(valor).toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
        hourCycle: "h23",
      })
    : "-";

const llenarSelect = (select, opciones, textoDe) => {
  const primera = select.options[0];
  select.replaceChildren(primera);
  opciones.forEach((opcion) => {
    const elemento = document.createElement("option");
    elemento.value = opcion._id;
    elemento.textContent = textoDe(opcion);
    select.appendChild(elemento);
  });
};

const configurarModal = (modal) => {
  modal.querySelectorAll(".btn-cerrar-modal").forEach((boton) => {
    boton.addEventListener("click", () => {
      modal.hidden = true;
    });
  });
};

const botonSalir = document.getElementById("btnLogout");
if (botonSalir) {
  botonSalir.addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      location.href = "/login";
    }
  });
}
