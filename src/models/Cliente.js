class Cliente {
  constructor(id, nombre, apellido, dni, telefono) {
    this.id = id;
    this.nombre = nombre;
    this.apellido = apellido;
    this.dni = dni;
    this.telefono = telefono;
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

module.exports = Cliente;
