// Comportamiento del shell: sidebar (riel colapsable en desktop, drawer en móvil/tablet)
// y menú flotante del usuario. Va en una IIFE para no chocar con las globales de api.js.
(() => {
  const raiz = document.documentElement;
  const botonSidebar = document.getElementById("btnSidebar");
  const botonCerrarSidebar = document.getElementById("btnCerrarSidebar");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlaySidebar");
  const botonMenu = document.getElementById("btnMenuUsuario");
  const menu = document.getElementById("menuUsuario");

  // Mismo valor que el breakpoint lg de Tailwind (1024px).
  const esDesktop = window.matchMedia("(min-width: 64rem)");
  const CLAVE_SIDEBAR = "turnoflex:sidebar";

  const guardarEstadoSidebar = (estado) => {
    try {
      localStorage.setItem(CLAVE_SIDEBAR, estado);
    } catch (error) {
      // Sin almacenamiento (modo privado, bloqueado): la preferencia no se recuerda.
    }
  };

  const sidebarVisible = () =>
    esDesktop.matches ? raiz.dataset.sidebar !== "colapsada" : raiz.dataset.drawer === "abierto";

  const actualizarAria = () => {
    if (botonSidebar) botonSidebar.setAttribute("aria-expanded", String(sidebarVisible()));
  };

  const abrirDrawer = () => {
    raiz.dataset.drawer = "abierto";
    actualizarAria();
    const primerEnlace = sidebar && sidebar.querySelector("a, button");
    if (primerEnlace) primerEnlace.focus();
  };

  const cerrarDrawer = ({ devolverFoco = false } = {}) => {
    if (raiz.dataset.drawer !== "abierto") return;
    delete raiz.dataset.drawer;
    actualizarAria();
    if (devolverFoco && botonSidebar) botonSidebar.focus();
  };

  const alternarSidebar = () => {
    if (esDesktop.matches) {
      const colapsar = raiz.dataset.sidebar !== "colapsada";
      if (colapsar) raiz.dataset.sidebar = "colapsada";
      else delete raiz.dataset.sidebar;
      guardarEstadoSidebar(colapsar ? "colapsada" : "expandida");
      actualizarAria();
    } else if (raiz.dataset.drawer === "abierto") {
      cerrarDrawer();
    } else {
      abrirDrawer();
    }
  };

  const menuAbierto = () => menu && !menu.hidden;

  const cerrarMenu = ({ devolverFoco = false } = {}) => {
    if (!menuAbierto()) return;
    menu.hidden = true;
    botonMenu.setAttribute("aria-expanded", "false");
    if (devolverFoco) botonMenu.focus();
  };

  const abrirMenu = () => {
    menu.hidden = false;
    botonMenu.setAttribute("aria-expanded", "true");
    const primeraOpcion = menu.querySelector("button, a");
    if (primeraOpcion) primeraOpcion.focus();
  };

  if (botonSidebar) botonSidebar.addEventListener("click", alternarSidebar);
  if (botonCerrarSidebar) {
    botonCerrarSidebar.addEventListener("click", () => cerrarDrawer({ devolverFoco: true }));
  }
  if (overlay) overlay.addEventListener("click", () => cerrarDrawer());
  if (sidebar) {
    sidebar.querySelectorAll("nav a").forEach((enlace) => {
      enlace.addEventListener("click", () => cerrarDrawer());
    });
  }

  // Al pasar a desktop el drawer no tiene sentido: se cierra.
  esDesktop.addEventListener("change", () => {
    delete raiz.dataset.drawer;
    actualizarAria();
  });

  if (botonMenu && menu) {
    botonMenu.addEventListener("click", (evento) => {
      evento.stopPropagation();
      if (menuAbierto()) cerrarMenu();
      else abrirMenu();
    });

    document.addEventListener("click", (evento) => {
      if (menuAbierto() && !menu.contains(evento.target)) cerrarMenu();
    });
  }

  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Escape") return;
    if (menuAbierto()) cerrarMenu({ devolverFoco: true });
    else cerrarDrawer({ devolverFoco: true });
  });

  actualizarAria();
})();
