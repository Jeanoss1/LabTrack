// Controlador del catálogo (HU-02)
import { listarEquipos } from "../models/Equipo.js";
import { filtrarPorCategoria } from "../servicios/reglas.js";
import { protegerVista, enlazarCerrarSesion } from "../static/js/sesion.js";
import { crear, celda, etiquetaEstado, manejar } from "../static/js/ui.js";

let equipos = [];
let categoriaActual = "Todos";

function filaEquipo(equipo) {
  const tr = crear("tr", { atributos: { "data-codigo": equipo.codigo } });
  const accion = equipo.estado === "Disponible"
    ? crear("a", { clase: "btn btn-chico", texto: "Reservar", atributos: { href: `/mis-reservas?equipo=${encodeURIComponent(equipo.id)}` } })
    : "";
  tr.append(celda(equipo.nombre), celda(equipo.codigo), celda(equipo.categoria), celda(etiquetaEstado(equipo.estado)), celda(accion));
  return tr;
}

function pintar() {
  const lista = filtrarPorCategoria(equipos, categoriaActual);
  document.getElementById("cuerpo-equipos").replaceChildren(...lista.map(filaEquipo));
  document.getElementById("mensaje-vacio").classList.toggle("oculto", lista.length > 0);
}

function enlazarFiltros() {
  const botones = document.querySelectorAll("#filtros .filtro");
  for (const boton of botones) {
    boton.addEventListener("click", () => {
      for (const otro of botones) otro.classList.remove("activo");
      boton.classList.add("activo");
      categoriaActual = boton.dataset.categoria;
      pintar();
    });
  }
}

async function iniciar() {
  const { perfil } = await protegerVista("estudiante");
  document.getElementById("nombre-usuario").textContent = `${perfil.nombre} (${perfil.codigo})`;
  equipos = await listarEquipos();
  pintar();
}

enlazarCerrarSesion();
enlazarFiltros();
manejar(iniciar(), "mensaje-error", "No se pudo cargar el catálogo.");
