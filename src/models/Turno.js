class Turno {
	constructor({
		id,
		cliente,
		profesional,
		fecha,
		hora,
        estado,
        precio,
        fechaCreacion,
        fechaModificacion
	}) {
		this.id = id;
		this.cliente = cliente;
		this.profesional = profesional;
		this.fecha = fecha;
		this.hora = hora;
        this.estado = estado;
        this.precio = precio;
        this.fechaCreacion = fechaCreacion;
        this.fechaModificacion = fechaModificacion;
	}
}

module.exports = Turno;
