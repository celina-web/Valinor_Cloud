const opcionesRegistro = document.getElementById("opcionesRegistro");
const registroNuevo = document.getElementById("registroNuevo");
const registroExistente = document.getElementById("registroExistente");
const formNuevoCliente = document.getElementById("formNuevoCliente");
const formVerificar = document.getElementById("formVerificar");
const formCrear = document.getElementById("formCrear");
const dniRegistro = document.getElementById("dniRegistro");
const dniVerificado = document.getElementById("dniVerificado");
const errorRegistro = document.getElementById("errorRegistro");

const volverAOpciones = () => {
  opcionesRegistro.hidden = false;
  registroNuevo.hidden = true;
  registroExistente.hidden = true;
  formVerificar.hidden = false;
  formCrear.hidden = true;
  formVerificar.reset();
  formCrear.reset();
  formNuevoCliente.reset();
  mostrarError(errorRegistro, "");
};

document.getElementById("btnNuevoCliente").addEventListener("click", () => {
  opcionesRegistro.hidden = true;
  registroNuevo.hidden = false;
});

document.getElementById("btnClienteExistente").addEventListener("click", () => {
  opcionesRegistro.hidden = true;
  registroExistente.hidden = false;
});

document.getElementById("volverNuevo").addEventListener("click", volverAOpciones);
document.getElementById("volverExistente").addEventListener("click", volverAOpciones);

formNuevoCliente.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarError(errorRegistro, "");
  try {
    await api("/api/auth/registro-cliente/nuevo", {
      method: "POST",
      body: leerFormulario(formNuevoCliente),
    });
    location.href = "/login";
  } catch (error) {
    mostrarError(errorRegistro, error.message);
  }
});

formVerificar.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarError(errorRegistro, "");
  try {
    await api("/api/auth/registro-cliente/verificar", {
      method: "POST",
      body: leerFormulario(formVerificar),
    });
    dniVerificado.value = dniRegistro.value.trim();
    formVerificar.hidden = true;
    formCrear.hidden = false;
  } catch (error) {
    mostrarError(errorRegistro, error.message);
  }
});

formCrear.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarError(errorRegistro, "");
  try {
    await api("/api/auth/registro-cliente", {
      method: "POST",
      body: leerFormulario(formCrear),
    });
    location.href = "/login";
  } catch (error) {
    mostrarError(errorRegistro, error.message);
  }
});
