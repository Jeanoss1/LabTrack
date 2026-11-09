// Controlador de reservas del estudiante (HU-03, flujo crítico)
import { listarEquipos } from "../models/Equipo.js";
import {
  reservasDeEstudiante, reservasActivasDeEstudiante, reservasAprobadasDeEquipo, crearReserva
} from "../models/Reserva.js";
import { validarReserva } from "../servicios/reglas.js";
import { protegerVista, enlazarCerrarSesion } from "../static/js/sesion.js";
import { crear, celda, etiquetaEstado, pintarTabla, mostrarMensaje, manejar } from "../static/js/ui.js";

const ID_MENSAJE = "reserva-mensaje";
let usuario = null;
let perfil = null;
let equipos = [];

function observacion(reserva) {
  if (reserva.motivoRechazo) return reserva.motivoRechazo;
  return reserva.penalizado ? "Devolución tardía" : "";
}

function filaReserva(r) {
  const tr = crear("tr");
  tr.append(
    celda(`${r.equipoCodigo} - ${r.equipoNombre}`),
    celda(r.fecha),
    celda(`${r.horaInicio} - ${r.horaFin}`),
    celda(etiquetaEstado(r.estado)),
    celda(observacion(r))
  );
  return tr;
}

async function cargarEquipos() {
  equipos = await listarEquipos();
  const select = document.getElementById("res-equipo");
  const preseleccion = new URLSearchParams(window.location.search).get("equipo");
  for (const e of equipos) {
    const opcion = crear("option", { texto: `${e.codigo} - ${e.nombre} (${e.estado})`, atributos: { value: e.id } });
    opcion.selected = e.id === preseleccion;
    select.append(opcion);
  }
}

async function cargarMisReservas() {
  const lista = await reservasDeEstudiante(usuario.uid);
  pintarTabla("cuerpo-mis-reservas", lista.map(filaReserva), 5, "Aún no tienes reservas.");
}

function leerFormulario() {
  const equipoId = document.getElementById("res-equipo").value;
  return {
    equipo: equipos.find((e) => e.id === equipoId) ?? null,
    fecha: document.getElementById("res-fecha").value,
    horaInicio: document.getElementById("res-inicio").value,
    horaFin: document.getElementById("res-fin").value
  };
}

async function solicitarReserva() {
  const solicitud = leerFormulario();
  const [activas, aprobadas] = await Promise.all([
    reservasActivasDeEstudiante(usuario.uid),
    solicitud.equipo ? reservasAprobadasDeEquipo(solicitud.equipo.id) : Promise.resolve([])
  ]);

  const resultado = validarReserva({
    ...solicitud,
    ahora: Date.now(),
    reservasActivasEstudiante: activas,
    reservasAprobadasEquipo: aprobadas,
    estadoEstudiante: perfil.estado
  });
  if (!resultado.ok) {
    mostrarMensaje(ID_MENSAJE, resultado.error, "error");
    return;
  }

  const { equipo } = solicitud;
  await crearReserva({
    estudianteId: usuario.uid,
    estudianteNombre: perfil.nombre,
    estudianteCodigo: perfil.codigo,
    equipoId: equipo.id,
    equipoNombre: equipo.nombre,
    equipoCodigo: equipo.codigo,
    fecha: solicitud.fecha,
    horaInicio: solicitud.horaInicio,
    horaFin: solicitud.horaFin,
    inicio: resultado.inicio,
    fin: resultado.fin
  });
  mostrarMensaje(ID_MENSAJE, "Solicitud de reserva registrada. Estado: Pendiente de aprobación.", "ok");
  document.getElementById("form-reserva").reset();
  await cargarMisReservas();
}

document.getElementById("form-reserva").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const boton = document.getElementById("btn-reservar");
  boton.disabled = true;
  const proceso = solicitarReserva().finally(() => { boton.disabled = false; });
  manejar(proceso, ID_MENSAJE, "No se pudo registrar la reserva. Intenta nuevamente.");
});

async function iniciar() {
  ({ user: usuario, perfil } = await protegerVista("estudiante"));
  document.getElementById("nombre-usuario").textContent = `${perfil.nombre} (${perfil.codigo})`;
  document.getElementById("aviso-penalizado").classList.toggle("visible", perfil.estado === "Penalizado");
  await cargarEquipos();
  await cargarMisReservas();
}

enlazarCerrarSesion();
manejar(iniciar(), ID_MENSAJE, "No se pudieron cargar tus datos.");
