// Controlador de reservas del estudiante (HU-03, flujo crítico)
import { auth } from "../oauth.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { obtenerPerfil } from "../models/Usuario.js";
import { listarEquipos } from "../models/Equipo.js";
import {
  reservasDeEstudiante, reservasActivasDeEstudiante, reservasAprobadasDeEquipo, crearReserva
} from "../models/Reserva.js";
import { validarReserva } from "../servicios/reglas.js";

var usuario = null;
var perfil = null;
var equipos = [];

// Control de sesión
onAuthStateChanged(auth, async function (user) {
  if (!user) {
    window.location.href = "/";
    return;
  }
  perfil = await obtenerPerfil(user.uid);
  if (!perfil) {
    window.location.href = "/completar-perfil";
    return;
  }
  if (perfil.rol == "admin") {
    window.location.href = "/admin";
    return;
  }
  usuario = user;
  document.getElementById("nombre-usuario").textContent = perfil.nombre + " (" + perfil.codigo + ")";
  if (perfil.estado == "Penalizado") {
    document.getElementById("aviso-penalizado").classList.add("visible");
  }
  await cargarEquipos();
  await cargarMisReservas();
});

document.getElementById("btn-salir").addEventListener("click", async function (e) {
  e.preventDefault();
  await signOut(auth);
  window.location.href = "/";
});

function mostrar(texto, tipo) {
  var el = document.getElementById("reserva-mensaje");
  el.textContent = texto;
  el.className = "mensaje visible " + tipo;
}

async function cargarEquipos() {
  equipos = await listarEquipos();
  var select = document.getElementById("res-equipo");
  var preseleccion = new URLSearchParams(window.location.search).get("equipo");
  for (var i = 0; i < equipos.length; i++) {
    var e = equipos[i];
    var op = document.createElement("option");
    op.value = e.id;
    op.textContent = e.codigo + " - " + e.nombre + " (" + e.estado + ")";
    if (e.id == preseleccion) op.selected = true;
    select.appendChild(op);
  }
}

async function cargarMisReservas() {
  var lista = await reservasDeEstudiante(usuario.uid);
  var cuerpo = document.getElementById("cuerpo-mis-reservas");
  var html = "";
  for (var i = 0; i < lista.length; i++) {
    var r = lista[i];
    html += "<tr>" +
      "<td>" + r.equipoCodigo + " - " + r.equipoNombre + "</td>" +
      "<td>" + r.fecha + "</td>" +
      "<td>" + r.horaInicio + " - " + r.horaFin + "</td>" +
      "<td><span class='estado estado-" + r.estado + "'>" + r.estado + "</span></td>" +
      "<td>" + (r.motivoRechazo ? r.motivoRechazo : (r.penalizado ? "Devolución tardía" : "")) + "</td>" +
      "</tr>";
  }
  if (html == "") html = "<tr><td colspan='5' class='vacio'>Aún no tienes reservas.</td></tr>";
  cuerpo.innerHTML = html;
}

document.getElementById("form-reserva").addEventListener("submit", async function (e) {
  e.preventDefault();
  var boton = document.getElementById("btn-reservar");
  boton.disabled = true;
  var equipoId = document.getElementById("res-equipo").value;
  var fecha = document.getElementById("res-fecha").value;
  var horaInicio = document.getElementById("res-inicio").value;
  var horaFin = document.getElementById("res-fin").value;
  var equipo = null;
  for (var i = 0; i < equipos.length; i++) {
    if (equipos[i].id == equipoId) equipo = equipos[i];
  }

  try {
    var activas = await reservasActivasDeEstudiante(usuario.uid);
    var aprobadas = equipo ? await reservasAprobadasDeEquipo(equipo.id) : [];

    var resultado = validarReserva({
      equipo: equipo,
      fecha: fecha,
      horaInicio: horaInicio,
      horaFin: horaFin,
      ahora: Date.now(),
      reservasActivasEstudiante: activas,
      reservasAprobadasEquipo: aprobadas,
      estadoEstudiante: perfil.estado
    });

    if (!resultado.ok) {
      mostrar(resultado.error, "error");
      boton.disabled = false;
      return;
    }

    await crearReserva({
      estudianteId: usuario.uid,
      estudianteNombre: perfil.nombre,
      estudianteCodigo: perfil.codigo,
      equipoId: equipo.id,
      equipoNombre: equipo.nombre,
      equipoCodigo: equipo.codigo,
      fecha: fecha,
      horaInicio: horaInicio,
      horaFin: horaFin,
      inicio: resultado.inicio,
      fin: resultado.fin
    });
    mostrar("Solicitud de reserva registrada. Estado: Pendiente de aprobación.", "ok");
    document.getElementById("form-reserva").reset();
    await cargarMisReservas();
  } catch (err) {
    console.log(err);
    mostrar("No se pudo registrar la reserva. Intenta nuevamente.", "error");
  }
  boton.disabled = false;
});
