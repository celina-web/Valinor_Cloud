// Chat de consultas en tiempo real. Las acciones van por la API REST (/api/chats, con api());
// Socket.io solo trae los eventos del servidor (y manda el indicador "escribiendo").
// Va en una IIFE para no chocar con las globales de api.js (api, rolActual, idUsuarioActual...).
(() => {
  const drawer = document.getElementById("drawerChat");
  const botonChat = document.getElementById("btnChat");
  if (!drawer || !botonChat || typeof io !== "function") return;

  const $ = (id) => document.getElementById(id);
  const raiz = document.documentElement;
  const esAdmin = drawer.dataset.rolChat === "admin";
  const ABIERTOS = ["pendiente", "activo"];
  const CLAVE_DRAWER = "turnoflex:chat";
  const CLAVE_VISTO = "turnoflex:chat-visto";

  const el = {
    badge: $("badgeChat"),
    titulo: $("chatTitulo"),
    subtitulo: $("chatSubtitulo"),
    estado: $("chatEstado"),
    error: $("errorChat"),
    cerrar: $("btnChatCerrar"),
    volver: $("btnChatVolver"),
    finalizar: $("btnChatFinalizar"),
    barraAdmin: $("chatBarraAdmin"),
    barraInfo: $("chatBarraInfo"),
    // Admin
    lista: $("chatLista"),
    carga: $("chatCarga"),
    listaPendientes: $("listaPendientes"),
    listaActivos: $("listaActivos"),
    sinPendientes: $("sinPendientes"),
    sinActivos: $("sinActivos"),
    // Recepción / profesional
    inicio: $("chatInicio"),
    formConsulta: $("formConsulta"),
    consultaTexto: $("consultaTexto"),
    consultaContador: $("consultaContador"),
    btnEnviarConsulta: $("btnEnviarConsulta"),
    espera: $("chatEspera"),
    esperaRestante: $("esperaRestante"),
    esperaMensajes: $("esperaMensajes"),
    nuevaConsulta: $("btnNuevaConsulta"),
    // Conversación
    conversacion: $("chatConversacion"),
    mensajes: $("chatMensajes"),
    escribiendo: $("chatEscribiendo"),
    formMensaje: $("formMensaje"),
    texto: $("chatTexto"),
    btnEnviarMensaje: $("btnEnviarMensaje"),
    cierre: $("chatCierre"),
    cierreTexto: $("chatCierreTexto"),
  };

  const estado = {
    chats: new Map(), // id -> chat (admin: sus abiertos; usuario: su chat actual o el último)
    abiertoId: null, // admin: conversación que está mirando
    noLeidos: new Set(),
    maxPorAdmin: null,
  };

  // ---------- Utilidades ----------

  const leerSesion = (clave) => {
    try {
      return sessionStorage.getItem(clave);
    } catch (error) {
      return null;
    }
  };
  const guardarSesion = (clave, valor) => {
    try {
      if (valor === null) sessionStorage.removeItem(clave);
      else sessionStorage.setItem(clave, valor);
    } catch (error) {
      // Sin almacenamiento: el drawer no recuerda su estado al navegar.
    }
  };

  const idDe = (valor) => String(valor && valor._id ? valor._id : valor);
  const estaAbierto = (chat) => chat && ABIERTOS.includes(chat.estado);
  const nombreDe = (usuario) => (usuario && usuario.nombre) || "(usuario eliminado)";
  const formatearHora = (valor) =>
    new Date(valor).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  const TEXTO_ESTADO = {
    pendiente: "Pendiente",
    activo: "Activo",
    finalizado: "Finalizado",
    rechazado: "Rechazado",
  };

  const textoDeCierre = (chat) => {
    if (chat.estado === "rechazado") {
      return esAdmin ? "Rechazaste esta consulta." : "Tu consulta fue rechazada por el operador.";
    }
    if (chat.motivoCierre === "timeout") {
      return esAdmin
        ? "La consulta expiró sin ser aceptada."
        : "Ningún operador aceptó tu consulta a tiempo. Podés enviarla de nuevo.";
    }
    return esAdmin
      ? "Finalizaste esta conversación."
      : "El operador finalizó la conversación. Para volver a consultar, iniciá un nuevo chat.";
  };

  const mostrarErrorChat = (mensaje) => mostrarError(el.error, mensaje);

  const restante = (fecha) => {
    const segundos = Math.max(0, Math.ceil((new Date(fecha).getTime() - Date.now()) / 1000));
    return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
  };

  // ¿El usuario está viendo este chat? (para marcar mensajes y consultas nuevas como leídos)
  const estaALaVista = (chat) => {
    if (!drawerAbierto() || !chat) return false;
    if (!esAdmin) return true;
    return estado.abiertoId ? estado.abiertoId === chat._id : chat.estado === "pendiente";
  };

  // Conversación que el usuario tiene abierta en el drawer.
  const chatVisible = () => {
    if (!drawerAbierto()) return null;
    if (esAdmin) return estado.abiertoId ? estado.chats.get(estado.abiertoId) : null;
    return chatDelUsuario();
  };

  const chatDelUsuario = () => estado.chats.values().next().value || null;

  // ---------- Drawer ----------

  const drawerAbierto = () => raiz.dataset.chat === "abierto";

  const enfocarDrawer = () => {
    const candidatos = [el.texto, el.consultaTexto, el.listaPendientes && el.listaPendientes.querySelector("button"), el.cerrar];
    const destino = candidatos.find((nodo) => nodo && !nodo.disabled && nodo.offsetParent !== null);
    if (destino) destino.focus();
  };

  const abrirDrawer = () => {
    raiz.dataset.chat = "abierto";
    guardarSesion(CLAVE_DRAWER, "abierto");
    botonChat.setAttribute("aria-expanded", "true");
    render();
    // Espera a que termine la transición de visibility para poder enfocar.
    setTimeout(enfocarDrawer, 210);
  };

  const cerrarDrawer = ({ devolverFoco = false } = {}) => {
    delete raiz.dataset.chat;
    guardarSesion(CLAVE_DRAWER, null);
    botonChat.setAttribute("aria-expanded", "false");
    if (devolverFoco) botonChat.focus();
  };

  // ---------- Render ----------

  const actualizarBadge = () => {
    const abiertos = [...estado.chats.values()].filter(estaAbierto).length;
    el.badge.textContent = abiertos > 9 ? "9+" : String(abiertos);
    el.badge.hidden = abiertos === 0;
    el.badge.classList.toggle("animate-pulse", estado.noLeidos.size > 0);
    const extra = abiertos ? ` (${abiertos} ${abiertos === 1 ? "abierto" : "abiertos"})` : "";
    botonChat.setAttribute("aria-label", `Chat de consultas${extra}`);
  };

  const mostrarEstado = (chat) => {
    if (!chat) {
      el.estado.hidden = true;
      return;
    }
    el.estado.className = `etiqueta estado-chat-${chat.estado}`;
    el.estado.textContent = TEXTO_ESTADO[chat.estado];
    el.estado.hidden = false;
  };

  const crearBurbuja = (mensaje) => {
    const propia = String(mensaje.autor) === idUsuarioActual;
    const item = document.createElement("li");
    item.className = `burbuja ${propia ? "burbuja-propia" : "burbuja-ajena"}`;
    item.dataset.id = mensaje._id;

    const texto = document.createElement("p");
    texto.className = "break-words whitespace-pre-wrap";
    texto.textContent = mensaje.texto;

    const hora = document.createElement("time");
    hora.className = `self-end text-[11px] ${propia ? "text-white/75" : "text-gray-500"}`;
    hora.dateTime = mensaje.createdAt;
    hora.textContent = formatearHora(mensaje.createdAt);

    item.append(texto, hora);
    return item;
  };

  // Solo agrega los mensajes nuevos (así aria-live no relee toda la conversación).
  const renderMensajes = (lista, chat) => {
    const cercaDelFinal = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80;
    const mismaConversacion = lista.dataset.chatId === chat._id;
    if (!mismaConversacion || lista.children.length > chat.mensajes.length) {
      lista.replaceChildren();
      lista.dataset.chatId = chat._id;
    }
    chat.mensajes.slice(lista.children.length).forEach((mensaje) => {
      lista.appendChild(crearBurbuja(mensaje));
    });
    if (!mismaConversacion || cercaDelFinal) lista.scrollTop = lista.scrollHeight;
  };

  const renderConversacion = (chat) => {
    el.conversacion.hidden = false;
    renderMensajes(el.mensajes, chat);

    const activo = chat.estado === "activo";
    el.formMensaje.hidden = !activo;
    el.texto.disabled = !activo;
    el.btnEnviarMensaje.disabled = !activo;
    el.cierre.hidden = activo;
    if (!activo) {
      el.escribiendo.hidden = true;
      el.cierreTexto.textContent = textoDeCierre(chat);
    }
  };

  const crearEtiquetaRol = (rol) => crearEtiqueta(rol, "etiqueta-info");

  const crearTarjetaPendiente = (chat) => {
    const item = document.createElement("li");
    item.className = "flex flex-col gap-3 rounded-xl border border-l-4 border-gray-200 border-l-turno-pendiente bg-white p-3 shadow-xs";

    const cabecera = document.createElement("div");
    cabecera.className = "flex items-center justify-between gap-2";
    const nombre = document.createElement("p");
    nombre.className = "truncate text-sm font-semibold text-gray-900";
    nombre.textContent = nombreDe(chat.solicitante);
    cabecera.append(nombre, crearEtiquetaRol(chat.rolSolicitante));

    const consulta = document.createElement("p");
    consulta.className = "line-clamp-4 text-sm break-words whitespace-pre-wrap text-gray-700";
    consulta.textContent = chat.mensajes[0] ? chat.mensajes[0].texto : "";

    const tiempo = document.createElement("p");
    tiempo.className = "text-xs text-gray-500";
    const cuenta = document.createElement("span");
    cuenta.className = "font-semibold tabular-nums text-gray-800";
    cuenta.dataset.expira = chat.expiraEl;
    cuenta.textContent = restante(chat.expiraEl);
    tiempo.append("Expira en ", cuenta);

    const acciones = document.createElement("div");
    acciones.className = "flex gap-2";
    const aceptar = crearBoton("Aceptar", "btn-atender flex-1", () => aceptarChat(chat));
    const rechazar = crearBoton("Rechazar", "btn-cancelar flex-1", () => rechazarChat(chat));
    acciones.append(aceptar, rechazar);

    item.append(cabecera, consulta, tiempo, acciones);
    return item;
  };

  const crearFilaActiva = (chat) => {
    const item = document.createElement("li");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "flex w-full cursor-pointer items-center gap-3 rounded-xl border border-l-4 border-gray-200 border-l-turno-presente bg-white p-3 text-left shadow-xs transition-colors hover:bg-lavanda-50 focus-visible:outline-2 focus-visible:outline-marca";
    boton.addEventListener("click", () => abrirConversacion(chat._id));

    const cuerpo = document.createElement("span");
    cuerpo.className = "min-w-0 flex-1";
    const nombre = document.createElement("span");
    nombre.className = "block truncate text-sm font-semibold text-gray-900";
    nombre.textContent = nombreDe(chat.solicitante);
    const ultimo = chat.mensajes[chat.mensajes.length - 1];
    const vista = document.createElement("span");
    vista.className = "block truncate text-xs text-gray-500";
    vista.textContent = ultimo ? ultimo.texto : "";
    cuerpo.append(nombre, vista);
    boton.appendChild(cuerpo);

    if (estado.noLeidos.has(chat._id)) {
      const punto = document.createElement("span");
      punto.className = "size-2.5 shrink-0 rounded-full bg-turno-cancelado";
      punto.title = "Mensajes sin leer";
      const textoOculto = document.createElement("span");
      textoOculto.className = "sr-only";
      textoOculto.textContent = "Mensajes sin leer";
      boton.append(punto, textoOculto);
    }
    item.appendChild(boton);
    return item;
  };

  const renderAdmin = () => {
    const chat = estado.abiertoId ? estado.chats.get(estado.abiertoId) : null;

    if (chat) {
      el.lista.hidden = true;
      el.volver.hidden = false;
      el.titulo.textContent = nombreDe(chat.solicitante);
      el.subtitulo.textContent = chat.solicitante
        ? `@${chat.solicitante.usuario} · ${chat.rolSolicitante}`
        : chat.rolSolicitante;
      mostrarEstado(chat);
      el.barraAdmin.hidden = false;
      el.barraInfo.textContent = `Iniciada a las ${formatearHora(chat.createdAt)}`;
      el.finalizar.hidden = chat.estado !== "activo";
      renderConversacion(chat);
      return;
    }

    el.conversacion.hidden = true;
    el.lista.hidden = false;
    el.volver.hidden = true;
    el.barraAdmin.hidden = true;
    el.titulo.textContent = "Consultas";
    el.subtitulo.textContent = "Chats asignados a vos";
    mostrarEstado(null);

    const abiertos = [...estado.chats.values()].filter(estaAbierto);
    const pendientes = abiertos.filter((c) => c.estado === "pendiente");
    const activos = abiertos.filter((c) => c.estado === "activo");
    el.carga.textContent = estado.maxPorAdmin ? `${abiertos.length} / ${estado.maxPorAdmin}` : String(abiertos.length);
    el.listaPendientes.replaceChildren(...pendientes.map(crearTarjetaPendiente));
    el.listaActivos.replaceChildren(...activos.map(crearFilaActiva));
    el.sinPendientes.hidden = pendientes.length > 0;
    el.sinActivos.hidden = activos.length > 0;
  };

  const renderUsuario = () => {
    let chat = chatDelUsuario();
    // Un chat cerrado que el usuario ya descartó con "Iniciar nueva consulta" no se vuelve a mostrar.
    if (chat && !estaAbierto(chat) && leerSesion(CLAVE_VISTO) === chat._id) chat = null;

    el.inicio.hidden = Boolean(chat);
    el.espera.hidden = !chat || chat.estado !== "pendiente";
    el.conversacion.hidden = !chat || chat.estado === "pendiente";
    mostrarEstado(chat);

    if (!chat) {
      el.subtitulo.textContent = "Te atiende un administrador";
      return;
    }
    if (chat.estado === "pendiente") {
      el.subtitulo.textContent = "Esperando a un operador";
      el.esperaRestante.dataset.expira = chat.expiraEl;
      el.esperaRestante.textContent = restante(chat.expiraEl);
      renderMensajes(el.esperaMensajes, chat);
      return;
    }
    el.subtitulo.textContent =
      chat.estado === "activo" ? `Te atiende ${nombreDe(chat.admin)}` : `Atendida por ${nombreDe(chat.admin)}`;
    renderConversacion(chat);
  };

  const render = () => {
    estado.noLeidos.forEach((id) => {
      const chat = estado.chats.get(id);
      if (!chat || estaALaVista(chat)) estado.noLeidos.delete(id);
    });
    if (esAdmin) renderAdmin();
    else renderUsuario();
    actualizarBadge();
  };

  // Cuenta regresiva informativa: el timeout real lo decide el servidor.
  setInterval(() => {
    drawer.querySelectorAll("[data-expira]").forEach((nodo) => {
      nodo.textContent = restante(nodo.dataset.expira);
    });
  }, 1000);

  // ---------- Estado ----------

  const guardarChat = (chat) => {
    estado.chats.set(chat._id, chat);
  };

  const cargar = async () => {
    try {
      const datos = await api("/api/chats");
      estado.maxPorAdmin = datos.maxPorAdmin;
      const mirando = estado.abiertoId ? estado.chats.get(estado.abiertoId) : null;
      estado.chats = new Map(datos.chats.map((chat) => [chat._id, chat]));
      // El admin miraba una conversación que ya no figura entre sus abiertas: si ya estaba
      // cerrada se conserva para leer el aviso; si no (se cerró o reasignó entretanto), vuelve a la lista.
      if (esAdmin && mirando && !estado.chats.has(mirando._id)) {
        if (estaAbierto(mirando)) estado.abiertoId = null;
        else estado.chats.set(mirando._id, mirando);
      }
      render();
    } catch (error) {
      mostrarErrorChat(error.message);
    }
  };

  const marcarNoLeido = (chatId) => {
    if (!estaALaVista(estado.chats.get(chatId))) estado.noLeidos.add(chatId);
  };

  // ---------- Acciones (API REST) ----------

  // Ejecuta una acción; si falla (por ejemplo, el chat expiró justo antes), muestra el error y resincroniza.
  const ejecutar = async (accion) => {
    mostrarErrorChat("");
    try {
      return await accion();
    } catch (error) {
      mostrarErrorChat(error.message);
      cargar();
      return null;
    }
  };

  const abrirConversacion = (chatId) => {
    estado.abiertoId = chatId;
    estado.noLeidos.delete(chatId);
    mostrarErrorChat("");
    render();
    if (el.texto && !el.texto.disabled) el.texto.focus();
  };

  const volverALista = () => {
    const chat = estado.chats.get(estado.abiertoId);
    if (chat && !estaAbierto(chat)) estado.chats.delete(chat._id);
    estado.abiertoId = null;
    mostrarErrorChat("");
    render();
  };

  const aceptarChat = (chat) =>
    ejecutar(async () => {
      const actualizado = await api(`/api/chats/${chat._id}/aceptar`, { method: "POST" });
      guardarChat(actualizado);
      abrirConversacion(actualizado._id);
    });

  const rechazarChat = async (chat) => {
    const confirmado = await confirmar({
      titulo: "Rechazar consulta",
      mensaje: `¿Rechazar la consulta de ${nombreDe(chat.solicitante)}?`,
      textoConfirmar: "Rechazar",
      variante: "peligro",
    });
    if (!confirmado) return;
    ejecutar(async () => {
      await api(`/api/chats/${chat._id}/rechazar`, { method: "POST" });
      estado.chats.delete(chat._id);
      render();
    });
  };

  const finalizarChat = async () => {
    const chat = estado.chats.get(estado.abiertoId);
    if (!chat) return;
    const confirmado = await confirmar({
      titulo: "Finalizar conversación",
      mensaje: `¿Finalizar la conversación con ${nombreDe(chat.solicitante)}? No se van a poder enviar más mensajes.`,
      textoConfirmar: "Finalizar",
    });
    if (!confirmado) return;
    ejecutar(async () => {
      guardarChat(await api(`/api/chats/${chat._id}/finalizar`, { method: "POST" }));
      render();
    });
  };

  const iniciarConsulta = (evento) => {
    evento.preventDefault();
    const mensaje = el.consultaTexto.value.trim();
    if (!mensaje) {
      mostrarErrorChat("Escribí tu consulta antes de enviarla");
      el.consultaTexto.focus();
      return;
    }
    el.btnEnviarConsulta.disabled = true;
    ejecutar(async () => {
      const chat = await api("/api/chats", { method: "POST", body: { mensaje } });
      estado.chats = new Map([[chat._id, chat]]);
      guardarSesion(CLAVE_VISTO, null);
      el.formConsulta.reset();
      el.consultaContador.textContent = "0 / 1000";
      render();
    }).finally(() => {
      el.btnEnviarConsulta.disabled = false;
    });
  };

  const agregarMensaje = (chatId, mensaje) => {
    const chat = estado.chats.get(chatId);
    if (!chat) return false;
    if (!chat.mensajes.some((existente) => existente._id === mensaje._id)) chat.mensajes.push(mensaje);
    return true;
  };

  const enviarMensaje = (evento) => {
    evento.preventDefault();
    const chat = esAdmin ? estado.chats.get(estado.abiertoId) : chatDelUsuario();
    const texto = el.texto.value.trim();
    if (!chat || !texto) return;
    el.btnEnviarMensaje.disabled = true;
    ejecutar(async () => {
      // Sin render optimista: se muestra lo que confirmó el servidor (deduplicado con el eco del socket).
      const mensaje = await api(`/api/chats/${chat._id}/mensajes`, { method: "POST", body: { texto } });
      agregarMensaje(chat._id, mensaje);
      el.texto.value = "";
      ajustarAltura();
      render();
    }).finally(() => {
      el.btnEnviarMensaje.disabled = el.texto.disabled;
      if (!el.texto.disabled) el.texto.focus();
    });
  };

  const nuevaConsulta = () => {
    const chat = chatDelUsuario();
    if (chat) guardarSesion(CLAVE_VISTO, chat._id);
    mostrarErrorChat("");
    render();
    el.consultaTexto.focus();
  };

  // ---------- Socket.io ----------

  // La cookie httpOnly viaja sola en el handshake (mismo origen).
  const socket = io();

  socket.on("connect", cargar); // al (re)conectar se recupera lo que pudo pasar mientras tanto

  socket.on("connect_error", (error) => {
    if (error.message === "NO_AUTENTICADO") location.href = "/login";
  });

  // El servidor cerró el socket (token vencido, logout, cambio de permisos): se intenta de nuevo
  // con la cookie vigente; si ya no es válida, connect_error lleva al login.
  socket.on("disconnect", (motivo) => {
    if (motivo === "io server disconnect") setTimeout(() => socket.connect(), 1000);
  });

  socket.on("chat:nuevo", (chat) => {
    guardarChat(chat);
    marcarNoLeido(chat._id);
    render();
  });

  socket.on("chat:actualizado", (chat) => {
    if (esAdmin && !estaAbierto(chat) && estado.abiertoId !== chat._id) estado.chats.delete(chat._id);
    else {
      if (!esAdmin) estado.chats = new Map();
      guardarChat(chat);
    }
    if (!esAdmin && chat.estado !== "pendiente") marcarNoLeido(chat._id);
    render();
    if (!esAdmin && chat.estado === "activo" && drawerAbierto()) el.texto.focus();
  });

  socket.on("chat:retirado", ({ chatId }) => {
    estado.chats.delete(chatId);
    estado.noLeidos.delete(chatId);
    if (estado.abiertoId === chatId) estado.abiertoId = null;
    render();
  });

  socket.on("chat:mensaje", ({ chatId, mensaje }) => {
    if (!agregarMensaje(chatId, mensaje)) {
      cargar();
      return;
    }
    if (String(mensaje.autor) !== idUsuarioActual) {
      marcarNoLeido(chatId);
      el.escribiendo.hidden = true;
    }
    render();
  });

  socket.on("chat:finalizado", ({ chatId, estado: nuevoEstado, motivo, cerradoEl }) => {
    const chat = estado.chats.get(chatId);
    if (!chat) return;
    if (esAdmin && estado.abiertoId !== chatId) {
      estado.chats.delete(chatId);
      estado.noLeidos.delete(chatId);
    } else {
      Object.assign(chat, { estado: nuevoEstado, motivoCierre: motivo, cerradoEl });
      if (!esAdmin) marcarNoLeido(chatId);
    }
    render();
  });

  let ocultarEscribiendo = null;
  socket.on("chat:escribiendo", ({ chatId }) => {
    const visible = chatVisible();
    if (!visible || visible._id !== chatId || visible.estado !== "activo") return;
    el.escribiendo.hidden = false;
    clearTimeout(ocultarEscribiendo);
    ocultarEscribiendo = setTimeout(() => {
      el.escribiendo.hidden = true;
    }, 3000);
  });

  // ---------- Eventos de la interfaz ----------

  const ajustarAltura = () => {
    el.texto.style.height = "auto";
    el.texto.style.height = `${Math.min(el.texto.scrollHeight, 128)}px`;
  };

  let ultimoAvisoEscribiendo = 0;
  el.texto.addEventListener("input", () => {
    ajustarAltura();
    const chat = esAdmin ? estado.chats.get(estado.abiertoId) : chatDelUsuario();
    if (!chat || chat.estado !== "activo" || Date.now() - ultimoAvisoEscribiendo < 2000) return;
    ultimoAvisoEscribiendo = Date.now();
    socket.emit("chat:escribiendo", { chatId: chat._id });
  });

  // Enter envía; Shift+Enter agrega un salto de línea.
  el.texto.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" && !evento.shiftKey && !evento.isComposing) {
      evento.preventDefault();
      el.formMensaje.requestSubmit();
    }
  });

  el.formMensaje.addEventListener("submit", enviarMensaje);

  botonChat.addEventListener("click", () => {
    if (drawerAbierto()) cerrarDrawer();
    else abrirDrawer();
  });
  el.cerrar.addEventListener("click", () => cerrarDrawer({ devolverFoco: true }));

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && drawerAbierto() && drawer.contains(document.activeElement)) {
      cerrarDrawer({ devolverFoco: true });
    }
  });

  if (esAdmin) {
    el.volver.addEventListener("click", volverALista);
    el.finalizar.addEventListener("click", finalizarChat);
  } else {
    el.formConsulta.addEventListener("submit", iniciarConsulta);
    el.consultaTexto.addEventListener("input", () => {
      el.consultaContador.textContent = `${el.consultaTexto.value.length} / 1000`;
    });
    el.nuevaConsulta.addEventListener("click", nuevaConsulta);
  }

  // Al cerrar sesión, el drawer no debe quedar abierto para el próximo usuario de la pestaña.
  const botonSalir = document.getElementById("btnLogout");
  if (botonSalir) {
    botonSalir.addEventListener("click", () => {
      guardarSesion(CLAVE_DRAWER, null);
      guardarSesion(CLAVE_VISTO, null);
    });
  }

  botonChat.setAttribute("aria-expanded", String(drawerAbierto()));
  render();
})();
