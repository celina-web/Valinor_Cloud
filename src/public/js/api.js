// El JWT viaja en una cookie httpOnly que el navegador envía solo (mismo origen):
// el JS no lo lee ni lo guarda, así no queda expuesto ante un XSS.
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
  boton.className = ["btn btn-chico", clase].filter(Boolean).join(" ");
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
    celdaAcciones.className = "whitespace-nowrap space-x-2";
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

// Confirmación de acciones con el modal +modalConfirmacion (src/views/includes/mixins.pug),
// en lugar del confirm() nativo del navegador. Devuelve una promesa: true si el usuario confirma,
// false si cancela (botón, Escape o click fuera del cuadro).
// variante: "peligro" (destructivas), "exito" o "primario" (por defecto).
const confirmar = (() => {
  const modal = document.getElementById("modalConfirmacion");
  if (!modal) return async ({ mensaje }) => window.confirm(mensaje);

  const titulo = document.getElementById("modalConfirmacionTitulo");
  const mensaje = document.getElementById("modalConfirmacionMensaje");
  const botonCancelar = document.getElementById("modalConfirmacionCancelar");
  const botonAceptar = document.getElementById("modalConfirmacionAceptar");
  const clasesBoton = { peligro: "btn-peligro", exito: "btn-atender", primario: "btn-primario" };
  let resolverPendiente = null;
  let focoPrevio = null;

  const cerrar = (resultado) => {
    if (!resolverPendiente) return;
    modal.hidden = true;
    const resolver = resolverPendiente;
    resolverPendiente = null;
    if (focoPrevio && document.contains(focoPrevio)) focoPrevio.focus();
    resolver(resultado);
  };

  botonCancelar.addEventListener("click", () => cerrar(false));
  botonAceptar.addEventListener("click", () => cerrar(true));
  // Click en el fondo oscuro (fuera del cuadro) cancela.
  modal.addEventListener("click", (evento) => {
    if (evento.target === modal) cerrar(false);
  });
  modal.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      // Que no lo procesen también la sidebar o el chat (escuchan Escape en document).
      evento.stopPropagation();
      cerrar(false);
    } else if (evento.key === "Tab") {
      // El foco queda atrapado entre los dos botones mientras el modal está abierto.
      evento.preventDefault();
      (document.activeElement === botonAceptar ? botonCancelar : botonAceptar).focus();
    }
  });

  return ({
    titulo: textoTitulo = "Confirmar acción",
    mensaje: textoMensaje,
    textoConfirmar = "Confirmar",
    textoCancelar = "Cancelar",
    variante = "primario",
  }) => {
    cerrar(false); // Si había otra confirmación abierta, cuenta como cancelada.
    const tipo = clasesBoton[variante] ? variante : "primario";
    titulo.textContent = textoTitulo;
    mensaje.textContent = textoMensaje;
    botonAceptar.textContent = textoConfirmar;
    botonCancelar.textContent = textoCancelar;
    botonAceptar.className = `btn ${clasesBoton[tipo]}`;
    modal.querySelectorAll("[data-variante]").forEach((icono) => {
      icono.hidden = icono.dataset.variante !== tipo;
    });

    focoPrevio = document.activeElement;
    modal.hidden = false;
    // En acciones destructivas el foco arranca en "Cancelar", para que un Enter no las ejecute.
    (tipo === "peligro" ? botonCancelar : botonAceptar).focus();
    return new Promise((resolver) => {
      resolverPendiente = resolver;
    });
  };
})();

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
