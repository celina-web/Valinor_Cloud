const formVerificar = document.getElementById("formVerificar");
const formCrear = document.getElementById("formCrear");
const dniRegistro = document.getElementById("dniRegistro");
const dniVerificado = document.getElementById("dniVerificado");
const errorRegistro = document.getElementById("errorRegistro");

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
