const passport = require("passport");
const { Strategy: LocalStrategy } = require("passport-local");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");

const Usuario = require("../models/Usuario");
const { JWT_SECRET, JWT_ALGORITMO, tokenDeCookie } = require("../helpers/token");

// Login: valida usuario y contraseña. Los fallos vuelven como `info` para que el
// controlador responda y audite (passport no responde nada por su cuenta).
passport.use(
  new LocalStrategy(
    { usernameField: "usuario", passwordField: "password" },
    async (usuarioIngresado, password, done) => {
      try {
        const nombreUsuario = String(usuarioIngresado).trim().toLowerCase();
        const usuario = await Usuario.findOne({ usuario: nombreUsuario }).select("+password");

        if (!usuario || !(await usuario.compararPassword(String(password)))) {
          return done(null, false, {
            status: 401,
            error: "Usuario o contraseña incorrectos",
            usuarioNombre: nombreUsuario,
            detalle: "Usuario o contraseña incorrectos",
          });
        }

        if (!usuario.estaHabilitado()) {
          return done(null, false, {
            status: 403,
            error: "Tu usuario está deshabilitado. Contactá a un administrador",
            usuario,
            detalle: "Usuario desactivado o vencido",
          });
        }

        return done(null, usuario);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Requests autenticadas: el token llega por header Bearer (API, Postman) o por la
// cookie httpOnly (navegador). La firma y la expiración las valida passport-jwt;
// acá se vuelve a leer el usuario para revocar al instante sin guardar sesiones.
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        tokenDeCookie,
      ]),
      secretOrKey: JWT_SECRET,
      algorithms: [JWT_ALGORITMO],
    },
    async (payload, done) => {
      try {
        const usuario = await Usuario.findById(payload.sub);

        if (!usuario || !usuario.estaHabilitado()) {
          return done(null, false, {
            revocado: true,
            usuario,
            payload,
            detalle: usuario ? "Usuario desactivado o vencido" : "El usuario fue eliminado",
          });
        }

        if (payload.ver !== usuario.tokenVersion) {
          return done(null, false, { mensaje: "Tu sesión fue cerrada. Ingresá de nuevo" });
        }

        return done(null, usuario, { payload });
      } catch (error) {
        return done(error);
      }
    }
  )
);

module.exports = passport;
