const ROLES = ["profesional", "recepcion", "admin"];

const profesional = [
  "clientes:read",
  "profesionales:read",
  "turnos:read",
  "turnos:update",
];

const recepcion = [
  ...profesional,
  "clientes:create",
  "clientes:update",
  "clientes:delete",
  "profesionales:create",
  "profesionales:update",
  "profesionales:delete",
  "turnos:create",
  "turnos:delete",
];

const admin = [
  ...recepcion,
  "usuarios:create",
  "usuarios:read",
  "usuarios:update",
  "usuarios:delete",
  "auditoria:read",
];

const PERMISOS_POR_ROL = { profesional, recepcion, admin };

const permisosDe = (rol) => PERMISOS_POR_ROL[rol] || [];

const tienePermiso = (rol, permiso) => permisosDe(rol).includes(permiso);

module.exports = { ROLES, PERMISOS_POR_ROL, permisosDe, tienePermiso };
