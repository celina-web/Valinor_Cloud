const formLogin = document.getElementById("formLogin");
const errorLogin = document.getElementById("errorLogin");

formLogin.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarError(errorLogin, "");
  try {
    await api("/api/auth/login", { method: "POST", body: leerFormulario(formLogin) });
    location.href = "/";
  } catch (error) {
    mostrarError(errorLogin, error.message);
    formLogin.password.value = "";
    formLogin.password.focus();
  }
});
