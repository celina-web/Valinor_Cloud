const fs = require("fs");
const path = require("path");

class JsonHelper {
  constructor(nombreArchivo) {
    this.rutaCarpeta = path.join(__dirname, "../data");
    this.rutaArchivo = path.join(this.rutaCarpeta, nombreArchivo);
    this.#asegurarArchivoExiste();
  }

  // Verifica y crea directorio/archivo si no existen
  #asegurarArchivoExiste() {
    if (!fs.existsSync(this.rutaCarpeta)) {
      fs.mkdirSync(this.rutaCarpeta, { recursive: true });
    }

    if (!fs.existsSync(this.rutaArchivo)) {
      fs.writeFileSync(this.rutaArchivo, JSON.stringify([], null, 2), "utf-8");
    }
  }

  // Leer archivo sincrónicamente
  leer() {
    this.#asegurarArchivoExiste();
    const data = fs.readFileSync(this.rutaArchivo, "utf-8");
    return JSON.parse(data || "[]");
  }

  // Escribir archivo sincrónicamente
  guardar(datos) {
    this.#asegurarArchivoExiste();
    fs.writeFileSync(this.rutaArchivo, JSON.stringify(datos, null, 2), "utf-8");
  }
}

module.exports = JsonHelper;
