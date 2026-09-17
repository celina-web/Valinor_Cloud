class Cliente {
  constructor({
    id,
    nombre,
    apellido,
    dni,
    // No obligatorios
    telefono = null,
    email = null,
    direccion = null,
  }) {

    this.id = id;
    this.nombre = nombre;
    this.apellido = apellido;
    this.dni = dni;
    this.telefono = telefono;
    this.email = email;
    this.direccion = direccion;
  }
}

module.exports = Cliente;