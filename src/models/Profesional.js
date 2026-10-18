const mongoose = require("mongoose");

const profesionalSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: [true, "El nombre es obligatorio"], trim: true },
    apellido: { type: String, required: [true, "El apellido es obligatorio"], trim: true },
    especialidad: { type: String, required: [true, "La especialidad es obligatoria"], trim: true },
    matricula: {
      type: String,
      required: [true, "La matrícula es obligatoria"],
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Profesional", profesionalSchema, "profesionales");
