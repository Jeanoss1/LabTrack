// Utilidades de interfaz compartidas por los controladores.
// Las tablas se construyen con nodos DOM y textContent (nunca innerHTML con datos de Firestore)
// para evitar inyección de HTML/JavaScript (XSS almacenado).

export function mostrarMensaje(id, texto, tipo) {
  const el = document.getElementById(id);
  el.textContent = texto;
  el.className = `mensaje visible ${tipo}`;
}

export function ocultarMensaje(id) {
  document.getElementById(id).className = "mensaje";
}

/** Crea un elemento con clase y texto opcionales. */
export function crear(etiqueta, { clase, texto, atributos = {} } = {}) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  for (const [nombre, valor] of Object.entries(atributos)) el.setAttribute(nombre, valor);
  return el;
}

/** Celda de tabla: acepta texto o uno o más nodos. */
export function celda(...contenido) {
  const td = document.createElement("td");
  for (const parte of contenido) {
    td.append(parte instanceof Node ? parte : document.createTextNode(String(parte ?? "")));
  }
  return td;
}

export function etiquetaEstado(estado) {
  return crear("span", { clase: `estado estado-${estado}`, texto: estado });
}

export function boton(texto, clase, alHacerClic) {
  const b = crear("button", { clase: `btn btn-chico ${clase}`, texto, atributos: { type: "button" } });
  b.addEventListener("click", alHacerClic);
  return b;
}

/** Nombre del estudiante con su código debajo. */
export function celdaEstudiante(reserva) {
  return celda(reserva.estudianteNombre, crear("br"), crear("small", { texto: reserva.estudianteCodigo }));
}

export function textoEquipo(reserva) {
  return `${reserva.equipoCodigo} - ${reserva.equipoNombre}`;
}

export function pintarTabla(idCuerpo, filas, columnas, textoVacio) {
  const cuerpo = document.getElementById(idCuerpo);
  if (filas.length === 0) {
    const tr = crear("tr");
    tr.append(crear("td", { clase: "vacio", texto: textoVacio, atributos: { colspan: String(columnas) } }));
    cuerpo.replaceChildren(tr);
    return;
  }
  cuerpo.replaceChildren(...filas);
}

/** Ejecuta un manejador asíncrono y muestra un mensaje si falla (evita promesas sin controlar). */
export function manejar(promesa, idMensaje, textoError) {
  promesa.catch((err) => {
    console.error(err);
    mostrarMensaje(idMensaje, textoError, "error");
  });
}
