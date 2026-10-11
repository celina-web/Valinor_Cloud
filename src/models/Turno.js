class Turno {
  constructor(id, clienteId, profesionalId, fecha, hora, estado = "reservado") {
    this.id = id;
    this.clienteId = clienteId;
    this.profesionalId = profesionalId;
    this.fecha = fecha; // Formato sugerido: "YYYY-MM-DD"
    this.hora = hora;   // Formato sugerido: "HH:mm"
    this.estado = estado; 
  }
}

module.exports = Turno;
