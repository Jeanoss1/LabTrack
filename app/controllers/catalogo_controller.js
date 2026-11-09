// Controlador del catálogo (HU-02)
import { auth } from "../oauth.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { obtenerPerfil } from "../models/Usuario.js";
import { listarEquipos } from "../models/Equipo.js";
import { filtrarPorCategoria, CATEGORIAS } from "../servicios/reglas.js";

var equipos = [];
var categoriaActual = "Todos";

// Control de sesión
onAuthStateChanged(auth, async function (user) {
  if (!user) {
    window.location.href = "/";
    return;
  }
  var perfil = await obtenerPerfil(user.uid);
  if (!perfil) {
    window.location.href = "/completar-perfil";
    return;
  }
  if (perfil.rol == "admin") {
    window.location.href = "/admin";
    return;
  }
  document.getElementById("nombre-usuario").textContent = perfil.nombre + " (" + perfil.codigo + ")";
  equipos = await listarEquipos();
  pintar();
});

document.getElementById("btn-salir").addEventListener("click", async function (e) {
  e.preventDefault();
  await signOut(auth);
  window.location.href = "/";
});

function pintar() {
  var lista = filtrarPorCategoria(equipos, categoriaActual);
  var cuerpo = document.getElementById("cuerpo-equipos");
  var vacio = document.getElementById("mensaje-vacio");
  var html = "";
  for (var i = 0; i < lista.length; i++) {
    var e = lista[i];
    html += "<tr data-codigo='" + e.codigo + "'>" +
      "<td>" + e.nombre + "</td>" +
      "<td>" + e.codigo + "</td>" +
      "<td>" + e.categoria + "</td>" +
      "<td><span class='estado estado-" + e.estado + "'>" + e.estado + "</span></td>" +
      "<td>" + (e.estado == "Disponible" ? "<a class='btn btn-chico' href='/mis-reservas?equipo=" + e.id + "'>Reservar</a>" : "") + "</td>" +
      "</tr>";
  }
  cuerpo.innerHTML = html;
  if (lista.length == 0) {
    vacio.classList.remove("oculto");
  } else {
    vacio.classList.add("oculto");
  }
}

// Filtros exactos por categoría
var botones = document.querySelectorAll("#filtros .filtro");
for (var i = 0; i < botones.length; i++) {
  botones[i].addEventListener("click", function () {
    for (var j = 0; j < botones.length; j++) botones[j].classList.remove("activo");
    this.classList.add("activo");
    categoriaActual = this.getAttribute("data-categoria");
    pintar();
  });
}
