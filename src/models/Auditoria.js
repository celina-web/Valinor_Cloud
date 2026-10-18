const mongoose = require("mongoose");

const ACCIONES = [
  "LOGIN",
  "LOGIN_FALLIDO",
  "LOGOUT",
  "CREAR",
  "MODIFICAR",
  "ELIMINAR",
  "CAMBIO_ESTADO",
  "ACCESO_DENEGADO",
  "SESION_REVOCADA",
];

const auditoriaSchema = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", default: null },
    usuarioNombre: { type: String, default: "anónimo" },
    accion: { type: String, enum: ACCIONES, required: true },
    entidad: { type: String },
    entidadId: { type: String },
    detalle: { type: String },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model("Auditoria", auditoriaSchema, "auditoria");
module.exports.ACCIONES = ACCIONES;
