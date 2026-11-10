const mongoose = require("mongoose");

// pendiente → activo | rechazado | finalizado (timeout); activo → finalizado (admin).
// "finalizado" y "rechazado" son estados finales.
const ESTADOS = ["pendiente", "activo", "finalizado", "rechazado"];
const ABIERTOS = ["pendiente", "activo"];
const MOTIVOS_CIERRE = ["admin", "timeout", "rechazo"];
const MAX_TEXTO = 1000;

const mensajeSchema = new mongoose.Schema(
  {
    autor: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
    texto: {
      type: String,
      trim: true,
      required: [true, "El mensaje no puede estar vacío"],
      maxlength: [MAX_TEXTO, `El mensaje no puede superar los ${MAX_TEXTO} caracteres`],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const chatSchema = new mongoose.Schema(
  {
    solicitante: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
    rolSolicitante: { type: String, enum: ["recepcion", "profesional"], required: true },
    // Admin asignado: cambia si el chat se reasigna mientras está pendiente.
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
    estado: { type: String, enum: ESTADOS, default: "pendiente" },
    motivoCierre: { type: String, enum: [...MOTIVOS_CIERRE, null], default: null },
    // Límite para que un admin acepte la solicitud (solo aplica en "pendiente").
    expiraEl: { type: Date, required: true },
    aceptadoEl: { type: Date, default: null },
    cerradoEl: { type: Date, default: null },
    mensajes: { type: [mensajeSchema], default: [] },
  },
  { timestamps: true }
);

chatSchema.index({ admin: 1, estado: 1 });
chatSchema.index({ estado: 1, expiraEl: 1 });
chatSchema.index({ solicitante: 1, createdAt: -1 });
// Un usuario no puede tener más de un chat abierto a la vez (respaldo del chequeo del servicio).
chatSchema.index(
  { solicitante: 1 },
  {
    unique: true,
    name: "un_chat_abierto_por_usuario",
    partialFilterExpression: { estado: { $in: ABIERTOS } },
  }
);

module.exports = mongoose.model("Chat", chatSchema);
module.exports.ESTADOS = ESTADOS;
module.exports.ABIERTOS = ABIERTOS;
module.exports.MAX_TEXTO = MAX_TEXTO;
