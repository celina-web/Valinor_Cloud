const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES } = require("../config/roles");

const usuarioSchema = new mongoose.Schema(
  {
    usuario: {
      type: String,
      required: [true, "El nombre de usuario es obligatorio"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9._-]{3,30}$/, "El usuario debe tener entre 3 y 30 caracteres, sin espacios"],
    },
    password: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
      minlength: [6, "La contraseña debe tener al menos 6 caracteres"],
      select: false,
    },
    nombre: { type: String, required: [true, "El nombre es obligatorio"], trim: true },
    rol: {
      type: String,
      enum: { values: ROLES, message: "El rol no es válido" },
      default: "profesional",
    },
    profesional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profesional",
      default: null,
      required: [
        function () {
          return this.rol === "profesional";
        },
        "Un usuario con rol profesional debe estar vinculado a un profesional",
      ],
    },
    activo: { type: Boolean, default: true },
    expiraEl: { type: Date, default: null },
    ultimoAcceso: { type: Date, default: null },
    // Se incrementa en el logout y al cambiar la contraseña: los JWT emitidos antes dejan de valer
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (documento, datos) => {
        delete datos.password;
        delete datos.tokenVersion;
        return datos;
      },
    },
  }
);

const RONDAS_BCRYPT = 10;

// Mongoose valida antes de este hook, así que minlength se aplica a la contraseña en claro
usuarioSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, RONDAS_BCRYPT);
  if (!this.isNew) this.tokenVersion += 1;
});

usuarioSchema.methods.compararPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

usuarioSchema.methods.estaHabilitado = function () {
  const vencido = this.expiraEl && this.expiraEl <= new Date();
  return this.activo && !vencido;
};

module.exports = mongoose.model("Usuario", usuarioSchema);
