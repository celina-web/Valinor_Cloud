const mongoose = require("mongoose");

const ESTADOS = ["reservado", "atendido", "cancelado"];

const turnoSchema = new mongoose.Schema(
  {
    cliente: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cliente",
      required: [true, "El cliente es obligatorio"],
    },
    profesional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profesional",
      required: [true, "El profesional es obligatorio"],
    },
    fecha: {
      type: String,
      required: [true, "La fecha es obligatoria"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato YYYY-MM-DD"],
    },
    hora: {
      type: String,
      required: [true, "La hora es obligatoria"],
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, "La hora debe tener el formato HH:mm"],
    },
    estado: {
      type: String,
      enum: { values: ESTADOS, message: "El estado no es válido" },
      default: "reservado",
    },
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Turno", turnoSchema);
module.exports.ESTADOS = ESTADOS;
