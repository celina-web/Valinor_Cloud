require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");

const conectarDB = require("./config/db");
const Cliente = require("./models/Cliente");
const Profesional = require("./models/Profesional");
const Turno = require("./models/Turno");
const Usuario = require("./models/Usuario");
const Auditoria = require("./models/Auditoria");

const fechaRelativa = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};

const CLIENTES = [
  { nombre: "Juan", apellido: "Pérez", dni: "28456789", telefono: "1145678901", email: "juan.perez@example.com" },
  { nombre: "María", apellido: "González", dni: "31234567", telefono: "1156789012", email: "maria.gonzalez@example.com" },
  { nombre: "Pedro", apellido: "Rodríguez", dni: "25678901", telefono: "1167890123", email: "pedro.rodriguez@example.com" },
  { nombre: "Ana", apellido: "Martínez", dni: "33987654", telefono: "1178901234" },
  { nombre: "Luis", apellido: "Fernández", dni: "22345678", telefono: "1189012345", email: "luis.fernandez@example.com" },
  { nombre: "Sofía", apellido: "López", dni: "35678901", telefono: "1190123456", email: "sofia.lopez@example.com" },
  { nombre: "Carlos", apellido: "Sánchez", dni: "29876543", telefono: "1101234567", email: "carlos.sanchez@example.com" },
  { nombre: "Lucía", apellido: "Romero", dni: "36789012", telefono: "1112345678", email: "lucia.romero@example.com" },
];

const PROFESIONALES = [
  { nombre: "Camila", apellido: "Ferreyra", especialidad: "Pilates Reformer", matricula: "PIL-1021" },
  { nombre: "Martín", apellido: "Acosta", especialidad: "Yoga", matricula: "YOG-2045" },
  { nombre: "Valeria", apellido: "Quiroga", especialidad: "Masajes descontracturantes", matricula: "MAS-3310" },
];

const TURNOS = [
  { cliente: 0, profesional: 0, dias: -20, hora: "14:00", estado: "atendido" },
  { cliente: 0, profesional: 0, dias: -20, hora: "15:00", estado: "cancelado" },
  { cliente: 5, profesional: 1, dias: -9, hora: "17:00", estado: "atendido" },
  { cliente: 3, profesional: 0, dias: -14, hora: "11:00", estado: "atendido" },
  { cliente: 6, profesional: 1, dias: -1, hora: "17:30", estado: "cancelado" },
  { cliente: 2, profesional: 0, dias: 0, hora: "09:00", estado: "atendido" },
  { cliente: 0, profesional: 0, dias: 0, hora: "10:00", estado: "reservado" },
  { cliente: 1, profesional: 0, dias: 0, hora: "11:30", estado: "reservado" },
  { cliente: 5, profesional: 1, dias: 0, hora: "12:00", estado: "reservado" },
  { cliente: 7, profesional: 2, dias: 0, hora: "16:00", estado: "cancelado" },
  { cliente: 4, profesional: 0, dias: 1, hora: "10:00", estado: "reservado" },
  { cliente: 3, profesional: 1, dias: 2, hora: "13:00", estado: "reservado" },
  { cliente: 6, profesional: 2, dias: 3, hora: "18:00", estado: "reservado" },
];

const sembrar = async () => {
  await conectarDB();

  await Promise.all([
    Cliente.deleteMany({}),
    Profesional.deleteMany({}),
    Turno.deleteMany({}),
    Usuario.deleteMany({}),
    Auditoria.deleteMany({}),
  ]);
  await Promise.all([Cliente.syncIndexes(), Profesional.syncIndexes(), Usuario.syncIndexes()]);

  const clientes = await Cliente.insertMany(CLIENTES);
  const profesionales = await Profesional.insertMany(PROFESIONALES);

  const admin = await Usuario.create({
    usuario: "admin",
    password: "admin123",
    nombre: "Administrador",
    rol: "admin",
  });

  await Usuario.create([
    { usuario: "recepcion", password: "recepcion123", nombre: "Recepcionista", rol: "recepcion" },
    {
      usuario: "profesional1",
      password: "prof1234",
      nombre: "Profesional 1",
      rol: "profesional",
      profesional: profesionales[0]._id,
    },
    {
      usuario: "profesional2",
      password: "prof5678",
      nombre: "Profesional 2",
      rol: "profesional",
      profesional: profesionales[1]._id,
    },
  ]);

  await Turno.insertMany(
    TURNOS.map((turno) => ({
      cliente: clientes[turno.cliente]._id,
      profesional: profesionales[turno.profesional]._id,
      fecha: fechaRelativa(turno.dias),
      hora: turno.hora,
      estado: turno.estado,
      creadoPor: admin._id,
    }))
  );

  console.log(
    `Datos cargados: ${clientes.length} clientes, ${profesionales.length} profesionales, ` +
      `${TURNOS.length} turnos y 4 usuarios.`
  );
};

sembrar()
  .catch((error) => {
    console.error("Error al cargar los datos:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
