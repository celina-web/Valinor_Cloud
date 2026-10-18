const formPerfil = document.getElementById("formPerfil");
const errorPerfil = document.getElementById("errorPerfil");
const estadoPerfil = document.getElementById("estadoPerfil");

const cargarPerfil = async () => {
  try {
    const cliente = await api("/api/mi-cuenta/perfil");
    llenarFormulario(formPerfil, cliente);
    mostrarError(errorPerfil, "");
  } catch (error) {
    mostrarError(errorPerfil, error.message);
  }
};

formPerfil.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarError(errorPerfil, "");
  estadoPerfil.hidden = true;
  try {
    const datos = leerFormulario(formPerfil);
    delete datos.dni;
    await api("/api/mi-cuenta/perfil", { method: "PUT", body: datos });
    estadoPerfil.textContent = "Perfil actualizado";
    estadoPerfil.hidden = false;
  } catch (error) {
    mostrarError(errorPerfil, error.message);
  }
});

cargarPerfil();
