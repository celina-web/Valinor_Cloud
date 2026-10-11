const mongoose = require("mongoose");

const clienteSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: [true, "El nombre es obligatorio"], trim: true },
    apellido: { type: String, required: [true, "El apellido es obligatorio"], trim: true },
    dni: {
      type: String,
      required: [true, "El DNI es obligatorio"],
      unique: true,
      trim: true,
      match: [/^\d{7,8}$/, "El DNI debe tener 7 u 8 números"],
    },
    telefono: { type: String, trim: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, "El email no es válido"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cliente", clienteSchema);
