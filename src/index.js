require("dotenv").config({ quiet: true });
const http = require("http");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");

const conectarDB = require("./config/db");
const passport = require("./config/passport");
const logger = require("./middlewares/logger");
const { notFound, errorHandler } = require("./middlewares/errores");
const { iniciarSocket } = require("./socket");
const { recuperarTimeouts } = require("./services/chatService");

const authRoutes = require("./routes/api/authRoutes");
const clientesRoutes = require("./routes/api/clientesRoutes");
const profesionalesRoutes = require("./routes/api/profesionalesRoutes");
const turnosRoutes = require("./routes/api/turnosRoutes");
const usuariosRoutes = require("./routes/api/usuariosRoutes");
const auditoriaRoutes = require("./routes/api/auditoriaRoutes");
const chatRoutes = require("./routes/api/chatRoutes");
const vistasRoutes = require("./routes/vistasRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(logger);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use("/api/auth", authRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/profesionales", profesionalesRoutes);
app.use("/api/turnos", turnosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/chats", chatRoutes);
// Ruta actual para marcar el ítem activo de la sidebar en las vistas.
app.use((req, res, next) => {
  res.locals.rutaActual = req.path;
  next();
});
app.use("/", vistasRoutes);

app.use(notFound);
app.use(errorHandler);

// Express y Socket.io comparten el mismo servidor HTTP (y el mismo puerto).
const servidor = http.createServer(app);
iniciarSocket(servidor);

const iniciar = async () => {
  await conectarDB();
  await recuperarTimeouts();
  servidor.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
};

iniciar().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error.message);
  process.exit(1);
});
