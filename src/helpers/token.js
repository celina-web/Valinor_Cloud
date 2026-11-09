const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "turnoflex-desarrollo";
const JWT_MINUTOS = Number(process.env.JWT_MINUTOS) || 30;
const JWT_ALGORITMO = "HS256";
const NOMBRE_COOKIE = "token";

if (!process.env.JWT_SECRET) {
  console.warn("Aviso: JWT_SECRET no está definido; se usa una clave de desarrollo.");
}

const firmarToken = (usuario) =>
  jwt.sign(
    { sub: String(usuario._id), usuario: usuario.usuario, ver: usuario.tokenVersion },
    JWT_SECRET,
    { algorithm: JWT_ALGORITMO, expiresIn: JWT_MINUTOS * 60 }
  );

const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

const enviarTokenEnCookie = (res, token) => {
  res.cookie(NOMBRE_COOKIE, token, { ...opcionesCookie(), maxAge: JWT_MINUTOS * 60 * 1000 });
};

const borrarCookieToken = (res) => {
  res.clearCookie(NOMBRE_COOKIE, opcionesCookie());
};

const tokenDeCookie = (req) => (req.cookies && req.cookies[NOMBRE_COOKIE]) || null;

module.exports = {
  JWT_SECRET,
  JWT_MINUTOS,
  JWT_ALGORITMO,
  firmarToken,
  enviarTokenEnCookie,
  borrarCookieToken,
  tokenDeCookie,
};
