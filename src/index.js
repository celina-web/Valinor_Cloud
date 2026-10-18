require("dotenv").config({ quiet: true });
const express = require("express");
const path = require("path");
const session = require("express-session");

const conectarDB = require("./config/db");
const logger = require("./middlewares/logger");
const { notFound, errorHandler } = require("./middlewares/errores");

const authRoutes = require("./routes/api/authRoutes");
const clientesRoutes = require("./routes/api/clientesRoutes");
const profesionalesRoutes = require("./routes/api/profesionalesRoutes");
const turnosRoutes = require("./routes/api/turnosRoutes");
const usuariosRoutes = require("./routes/api/usuariosRoutes");
const auditoriaRoutes = require("./routes/api/auditoriaRoutes");
const miCuentaRoutes = require("./routes/api/miCuentaRoutes");
const vistasRoutes = require("./routes/vistasRoutes");

const app = express();
const PORT = process.env.PORT || 3000;
const MINUTOS_SESION = Number(process.env.SESSION_MINUTOS) || 30;

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(logger);
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "turnoflex-desarrollo",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: MINUTOS_SESION * 60 * 1000 },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/mi-cuenta", miCuentaRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/profesionales", profesionalesRoutes);
app.use("/api/turnos", turnosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/", vistasRoutes);

app.use(notFound);
app.use(errorHandler);

const iniciar = async () => {
  await conectarDB();
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
};

iniciar().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error.message);
  process.exit(1);
});
