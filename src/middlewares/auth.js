const passport = require("../config/passport");
const { tienePermiso, permisosDe } = require("../config/roles");
const { registrarAuditoria } = require("../helpers/auditoria");
const {
  JWT_MINUTOS,
  firmarToken,
  enviarTokenEnCookie,
  borrarCookieToken,
  tokenDeCookie,
} = require("../helpers/token");

const esApi = (req) => req.originalUrl.startsWith("/api");

// Envuelve passport.authenticate (con callback) en una Promise para poder usar
// await y que Express 5 lleve cualquier error al errorHandler.
const autenticar = (estrategia, req, res) =>
  new Promise((resolve, reject) => {
    passport.authenticate(estrategia, { session: false }, (error, usuario, info) => {
      if (error) return reject(error);
      resolve({ usuario, info: info || {} });
    })(req, res, reject);
  });

const responderSinSesion = (req, res, mensaje) => {
  if (esApi(req)) return res.status(401).json({ error: mensaje });
  return res.redirect("/login");
};

const mensajeDeRechazo = (info) => {
  if (info.revocado) return "Tu sesión fue revocada";
  if (info.mensaje) return info.mensaje;
  if (info.name === "TokenExpiredError") return "Tu sesión expiró. Ingresá de nuevo";
  return "Debés iniciar sesión";
};

const vinoPorCookie = (req) => !req.headers.authorization && Boolean(tokenDeCookie(req));

// Renovación deslizante: si el token de la cookie ya consumió la mitad de su vida,
// se emite uno nuevo. Así la expiración funciona como "minutos de inactividad".
const renovarSiHaceFalta = (req, res, usuario, payload) => {
  if (!payload || !vinoPorCookie(req)) return;
  const segundosRestantes = payload.exp - Math.floor(Date.now() / 1000);
  if (segundosRestantes < (JWT_MINUTOS * 60) / 2) {
    enviarTokenEnCookie(res, firmarToken(usuario));
  }
};

const cargarUsuario = (req, res, usuario) => {
  req.usuario = usuario;
  res.locals.usuario = usuario;
  res.locals.permisos = permisosDe(usuario.rol);
  res.locals.puede = (permiso) => tienePermiso(usuario.rol, permiso);
};

const requiereLogin = async (req, res, next) => {
  const { usuario, info } = await autenticar("jwt", req, res);

  if (!usuario) {
    if (info.revocado) {
      await registrarAuditoria(req, "SESION_REVOCADA", {
        usuario: info.usuario,
        usuarioNombre: info.payload.usuario,
        entidad: "Usuario",
        entidadId: info.payload.sub,
        detalle: info.detalle,
      });
    }
    if (tokenDeCookie(req)) borrarCookieToken(res);
    return responderSinSesion(req, res, mensajeDeRechazo(info));
  }

  renovarSiHaceFalta(req, res, usuario, info.payload);
  cargarUsuario(req, res, usuario);
  next();
};

// Para páginas públicas (login): carga el usuario si hay un token válido, sin cortar la request.
const usuarioOpcional = async (req, res, next) => {
  const { usuario } = await autenticar("jwt", req, res);
  if (usuario) cargarUsuario(req, res, usuario);
  next();
};

const requierePermiso = (permiso) => async (req, res, next) => {
  if (tienePermiso(req.usuario.rol, permiso)) return next();

  await registrarAuditoria(req, "ACCESO_DENEGADO", {
    detalle: `${req.method} ${req.originalUrl} requiere ${permiso}`,
  });

  if (esApi(req)) {
    return res.status(403).json({ error: "No tenés permiso para realizar esta acción" });
  }
  return res.status(403).render("error", {
    codigo: 403,
    titulo: "Acceso denegado",
    mensaje: "No tenés permiso para ver esta página. Si creés que es un error, consultá con un administrador.",
  });
};

module.exports = { autenticar, requiereLogin, usuarioOpcional, requierePermiso };
