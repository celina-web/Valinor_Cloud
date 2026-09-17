class Profesional {
	constructor({
		id,
		nombre,
		apellido,
		dni,
		telefono,
		email,
		direccion,
        diaDisponible,
		horario
	}) {
		this.id = id;
		this.nombre = nombre;
		this.apellido = apellido;
		this.dni = dni;
		this.telefono = telefono;
		this.email = email;
		this.direccion = direccion;
		this.diaDisponible = diaDisponible;
        this.horario = horario;
	}
}

module.exports = Profesional;
