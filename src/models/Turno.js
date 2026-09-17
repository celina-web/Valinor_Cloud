class Turno {
	constructor({
		id,
		idCliente,
		idProfesional,
		fecha,
		hora,
        estado,
        precio,
        fechaCreacion,
        fechaModificacion
	}) {
		this.id = id;
		this.idCliente = idCliente;
		this.idProfesional = idProfesional;
		this.fecha = fecha;
		this.hora = hora;
        this.estado = estado;
        this.precio = precio;
        this.fechaCreacion = fechaCreacion;
        this.fechaModificacion = fechaModificacion;
	}
}

module.exports = Turno;
