// Controlador del panel del encargado (HU-04 gestión de solicitudes, HU-05 devoluciones)
import { auth } from "../oauth.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { obtenerPerfil } from "../models/Usuario.js";
import {
  reservasPendientes, reservasAprobadas, reservasAprobadasDeEquipo,
  aprobarReserva, rechazarReserva, registrarDevolucion
} from "../models/Reserva.js";
import { debePenalizar, seCruzan } from "../servicios/reglas.js";

var pendientes = [];
var activas = [];
var reservaARechazar = null;

// Control de sesión
onAuthStateChanged(auth, async function (user) {
  if (!user) {
    window.location.href = "/";
    return;
  }
  var perfil = await obtenerPerfil(user.uid);
  if (!perfil) {
    window.location.href = "/";
    return;
  }
  if (perfil.rol != "admin") {
    window.location.href = "/catalogo";
    return;
  }
  document.getElementById("nombre-usuario").textContent = perfil.nombre;
  await cargarPendientes();
  await cargarActivas();
});

document.getElementById("btn-salir").addEventListener("click", async function (e) {
  e.preventDefault();
  await signOut(auth);
  window.location.href = "/";
});

function mostrar(texto, tipo) {
  var el = document.getElementById("admin-mensaje");
  el.textContent = texto;
  el.className = "mensaje visible " + tipo;
}

// Listado de reservas pendientes
async function cargarPendientes() {
  pendientes = await reservasPendientes();
  var cuerpo = document.getElementById("cuerpo-pendientes");
  var html = "";
  for (var i = 0; i < pendientes.length; i++) {
    var r = pendientes[i];
    html += "<tr data-id='" + r.id + "'>" +
      "<td>" + r.estudianteNombre + "<br><small>" + r.estudianteCodigo + "</small></td>" +
      "<td>" + r.equipoCodigo + " - " + r.equipoNombre + "</td>" +
      "<td>" + r.fecha + " " + r.horaInicio + " - " + r.horaFin + "</td>" +
      "<td><button class='btn btn-chico btn-verde btn-aprobar' data-id='" + r.id + "'>Aprobar</button> " +
      "<button class='btn btn-chico btn-rojo btn-rechazar' data-id='" + r.id + "'>Rechazar</button></td>" +
      "</tr>";
  }
  if (pendientes.length == 0) html = "<tr><td colspan='4' class='vacio'>No hay solicitudes pendientes.</td></tr>";
  cuerpo.innerHTML = html;

  var aprobar = document.querySelectorAll(".btn-aprobar");
  for (var j = 0; j < aprobar.length; j++) {
    aprobar[j].addEventListener("click", function () { aprobar_(this.getAttribute("data-id")); });
  }
  var rechazar = document.querySelectorAll(".btn-rechazar");
  for (var k = 0; k < rechazar.length; k++) {
    rechazar[k].addEventListener("click", function () { abrirRechazo(this.getAttribute("data-id")); });
  }
}

async function aprobar_(id) {
  var r = null;
  for (var i = 0; i < pendientes.length; i++) {
    if (pendientes[i].id == id) r = pendientes[i];
  }
  if (r == null) return;

  // no aprobar si ya existe otra reserva aprobada que se cruce
  var aprobadas = await reservasAprobadasDeEquipo(r.equipoId);
  var cruce = false;
  for (var j = 0; j < aprobadas.length; j++) {
    if (seCruzan(aprobadas[j], r)) cruce = true;
  }
  if (cruce) {
    mostrar("No se puede aprobar: el equipo ya tiene una reserva aprobada que se cruza con ese horario.", "error");
    return;
  }

  await aprobarReserva(r);
  mostrar("Reserva aprobada. El equipo " + r.equipoCodigo + " pasó a estado Prestado.", "ok");
  await cargarPendientes();
  await cargarActivas();
}

function abrirRechazo(id) {
  reservaARechazar = id;
  document.getElementById("motivo-rechazo").value = "";
  document.getElementById("rechazo-mensaje").className = "mensaje";
  document.getElementById("modal-rechazo").classList.add("visible");
}

document.getElementById("btn-cancelar-rechazo").addEventListener("click", function () {
  document.getElementById("modal-rechazo").classList.remove("visible");
  reservaARechazar = null;
});

document.getElementById("btn-confirmar-rechazo").addEventListener("click", async function () {
  var motivo = document.getElementById("motivo-rechazo").value.trim();
  if (motivo == "") {
    var el = document.getElementById("rechazo-mensaje");
    el.textContent = "Debes ingresar el motivo del rechazo.";
    el.className = "mensaje visible error";
    return;
  }
  await rechazarReserva(reservaARechazar, motivo);
  document.getElementById("modal-rechazo").classList.remove("visible");
  mostrar("Solicitud rechazada. Motivo: " + motivo, "ok");
  reservaARechazar = null;
  await cargarPendientes();
});

// Devolución y penalización automática
async function cargarActivas() {
  activas = await reservasAprobadas();
  pintarActivas();
}

function pintarActivas() {
  var texto = document.getElementById("buscar-activa").value.trim().toLowerCase();
  var cuerpo = document.getElementById("cuerpo-activas");
  var html = "";
  for (var i = 0; i < activas.length; i++) {
    var r = activas[i];
    var buscable = (r.estudianteNombre + " " + r.estudianteCodigo + " " + r.equipoCodigo + " " + r.equipoNombre).toLowerCase();
    if (texto != "" && buscable.indexOf(texto) == -1) continue;
    html += "<tr data-id='" + r.id + "'>" +
      "<td>" + r.estudianteNombre + "<br><small>" + r.estudianteCodigo + "</small></td>" +
      "<td>" + r.equipoCodigo + " - " + r.equipoNombre + "</td>" +
      "<td>" + r.fecha + " " + r.horaInicio + " - " + r.horaFin + "</td>" +
      "<td><span class='estado estado-" + r.estado + "'>" + r.estado + "</span></td>" +
      "<td><button class='btn btn-chico btn-devolucion' data-id='" + r.id + "'>Marcar Devolución</button></td>" +
      "</tr>";
  }
  if (html == "") html = "<tr><td colspan='5' class='vacio'>No hay reservas activas.</td></tr>";
  cuerpo.innerHTML = html;
  var botones = document.querySelectorAll(".btn-devolucion");
  for (var j = 0; j < botones.length; j++) {
    botones[j].addEventListener("click", function () { marcarDevolucion(this.getAttribute("data-id")); });
  }
}

document.getElementById("buscar-activa").addEventListener("input", pintarActivas);

async function marcarDevolucion(id) {
  var r = null;
  for (var i = 0; i < activas.length; i++) {
    if (activas[i].id == id) r = activas[i];
  }
  if (r == null) return;
  var ahora = Date.now();
  var tarde = debePenalizar(r.fin, ahora);
  await registrarDevolucion(r, ahora, tarde);
  if (tarde) {
    mostrar("Devolución registrada fuera de plazo. El estudiante " + r.estudianteNombre + " fue Penalizado.", "alerta");
  } else {
    mostrar("Devolución registrada a tiempo. El equipo " + r.equipoCodigo + " está Disponible.", "ok");
  }
  await cargarActivas();
}
