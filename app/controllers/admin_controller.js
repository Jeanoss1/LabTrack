// Controlador del panel del encargado (HU-04 gestión de solicitudes, HU-05 devoluciones)
import {
  reservasPendientes, reservasAprobadas, reservasAprobadasDeEquipo,
  aprobarReserva, rechazarReserva, registrarDevolucion
} from "../models/Reserva.js";
import { debePenalizar, seCruzan } from "../servicios/reglas.js";
import { protegerVista, enlazarCerrarSesion } from "../static/js/sesion.js";
import {
  crear, celda, celdaEstudiante, textoEquipo, etiquetaEstado, boton, pintarTabla,
  mostrarMensaje, ocultarMensaje, manejar
} from "../static/js/ui.js";

const ID_MENSAJE = "admin-mensaje";
const modal = document.getElementById("modal-rechazo");
let pendientes = [];
let activas = [];
let reservaARechazar = null;

const horario = (r) => `${r.fecha} ${r.horaInicio} - ${r.horaFin}`;
const accion = (promesa) => manejar(promesa, ID_MENSAJE, "Ocurrió un error al guardar los cambios. Intenta nuevamente.");

// ---- HU-04: solicitudes pendientes ----
function filaPendiente(r) {
  const tr = crear("tr", { atributos: { "data-id": r.id } });
  tr.append(
    celdaEstudiante(r),
    celda(textoEquipo(r)),
    celda(horario(r)),
    celda(
      boton("Aprobar", "btn-verde btn-aprobar", () => accion(aprobar(r))),
      " ",
      boton("Rechazar", "btn-rojo btn-rechazar", () => abrirRechazo(r.id))
    )
  );
  return tr;
}

async function cargarPendientes() {
  pendientes = await reservasPendientes();
  pintarTabla("cuerpo-pendientes", pendientes.map(filaPendiente), 4, "No hay solicitudes pendientes.");
}

async function aprobar(reserva) {
  const aprobadas = await reservasAprobadasDeEquipo(reserva.equipoId);
  if (aprobadas.some((otra) => seCruzan(otra, reserva))) {
    mostrarMensaje(ID_MENSAJE, "No se puede aprobar: el equipo ya tiene una reserva aprobada que se cruza con ese horario.", "error");
    return;
  }
  await aprobarReserva(reserva);
  mostrarMensaje(ID_MENSAJE, `Reserva aprobada. El equipo ${reserva.equipoCodigo} pasó a estado Prestado.`, "ok");
  await Promise.all([cargarPendientes(), cargarActivas()]);
}

function abrirRechazo(id) {
  reservaARechazar = id;
  document.getElementById("motivo-rechazo").value = "";
  ocultarMensaje("rechazo-mensaje");
  modal.classList.add("visible");
}

function cerrarRechazo() {
  modal.classList.remove("visible");
  reservaARechazar = null;
}

async function confirmarRechazo() {
  const motivo = document.getElementById("motivo-rechazo").value.trim();
  if (motivo === "") {
    mostrarMensaje("rechazo-mensaje", "Debes ingresar el motivo del rechazo.", "error");
    return;
  }
  await rechazarReserva(reservaARechazar, motivo);
  cerrarRechazo();
  mostrarMensaje(ID_MENSAJE, `Solicitud rechazada. Motivo: ${motivo}`, "ok");
  await cargarPendientes();
}

// ---- HU-05: devolución y penalización automática ----
function coincide(reserva, texto) {
  const buscable = `${reserva.estudianteNombre} ${reserva.estudianteCodigo} ${reserva.equipoCodigo} ${reserva.equipoNombre}`;
  return buscable.toLowerCase().includes(texto);
}

function filaActiva(r) {
  const tr = crear("tr", { atributos: { "data-id": r.id } });
  tr.append(
    celdaEstudiante(r),
    celda(textoEquipo(r)),
    celda(horario(r)),
    celda(etiquetaEstado(r.estado)),
    celda(boton("Marcar Devolución", "btn-devolucion", () => accion(marcarDevolucion(r))))
  );
  return tr;
}

function pintarActivas() {
  const texto = document.getElementById("buscar-activa").value.trim().toLowerCase();
  const visibles = activas.filter((r) => coincide(r, texto));
  pintarTabla("cuerpo-activas", visibles.map(filaActiva), 5, "No hay reservas activas.");
}

async function cargarActivas() {
  activas = await reservasAprobadas();
  pintarActivas();
}

async function marcarDevolucion(reserva) {
  const ahora = Date.now();
  const tarde = debePenalizar(reserva.fin, ahora);
  await registrarDevolucion(reserva, ahora, tarde);
  if (tarde) {
    mostrarMensaje(ID_MENSAJE, `Devolución registrada fuera de plazo. El estudiante ${reserva.estudianteNombre} fue Penalizado.`, "alerta");
  } else {
    mostrarMensaje(ID_MENSAJE, `Devolución registrada a tiempo. El equipo ${reserva.equipoCodigo} está Disponible.`, "ok");
  }
  await cargarActivas();
}

// ---- Inicio ----
async function iniciar() {
  const { perfil } = await protegerVista("admin");
  document.getElementById("nombre-usuario").textContent = perfil.nombre;
  await Promise.all([cargarPendientes(), cargarActivas()]);
}

document.getElementById("btn-cancelar-rechazo").addEventListener("click", cerrarRechazo);
document.getElementById("btn-confirmar-rechazo").addEventListener("click", () => accion(confirmarRechazo()));
document.getElementById("buscar-activa").addEventListener("input", pintarActivas);
enlazarCerrarSesion();
accion(iniciar());
