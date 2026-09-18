class Profesional {
  constructor({
    id,
    nombre,
    apellido,
    dni,
    telefono = null,
    email = null,
    direccion = null,
    diaDisponible = null,
    horario = null,
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

  nombreCompleto() {
    return `${this.nombre} ${this.apellido}`;
  }

  static validar(datos = {}) {
    const errores = [];
    if (!datos.nombre) errores.push('El nombre es obligatorio');
    if (!datos.apellido) errores.push('El apellido es obligatorio');
    if (!datos.dni) errores.push('El dni es obligatorio');
    return errores;
  }
}

module.exports = Profesional;
