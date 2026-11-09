// Reglas de negocio de LabTrack (sin dependencias de Firebase para poder probarlas)

export const CATEGORIAS = Object.freeze(["Cómputo", "Electrónica", "Redes"]);
export const MAX_INTENTOS = 3;
export const MINUTOS_BLOQUEO = 5;
const MS_POR_MINUTO = 60 * 1000;

export const MENSAJES = Object.freeze({
  penalizado: "Tu cuenta está penalizada. No puedes realizar nuevas reservas.",
  sinEquipo: "Selecciona un equipo.",
  camposIncompletos: "Completa la fecha, la hora de inicio y la hora de fin.",
  horarioInvalido: "La hora de fin debe ser posterior a la hora de inicio.",
  fechaPasada: "No puedes reservar en una fecha u hora pasada.",
  reservaActiva: "Ya tienes un equipo reservado. Solo se permite una reserva activa a la vez.",
  cruce: "El equipo ya tiene una reserva aprobada que se cruza con ese horario."
});

/** Convierte una fecha "AAAA-MM-DD" y una hora "HH:MM" (hora local) a milisegundos. */
export function aMilisegundos(fecha, hora) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [horas, minutos] = hora.split(":").map(Number);
  return new Date(anio, mes - 1, dia, horas, minutos, 0, 0).getTime();
}

/** Dos intervalos [inicio, fin) se cruzan si cada uno empieza antes de que termine el otro. */
export function seCruzan(a, b) {
  return a.inicio < b.fin && b.inicio < a.fin;
}

export function filtrarPorCategoria(equipos, categoria) {
  if (categoria === "Todos") return [...equipos];
  return equipos.filter((equipo) => equipo.categoria === categoria);
}

function error(mensaje) {
  return { ok: false, error: mensaje };
}

/**
 * Valida una solicitud de reserva (HU-03).
 * Devuelve { ok: true, inicio, fin } o { ok: false, error }.
 */
export function validarReserva(datos) {
  const { equipo, fecha, horaInicio, horaFin, ahora, estadoEstudiante } = datos;

  if (estadoEstudiante === "Penalizado") return error(MENSAJES.penalizado);
  if (!equipo) return error(MENSAJES.sinEquipo);
  if (!fecha || !horaInicio || !horaFin) return error(MENSAJES.camposIncompletos);

  const solicitud = { inicio: aMilisegundos(fecha, horaInicio), fin: aMilisegundos(fecha, horaFin) };

  if (solicitud.fin <= solicitud.inicio) return error(MENSAJES.horarioInvalido);
  if (solicitud.inicio < ahora) return error(MENSAJES.fechaPasada);
  if (datos.reservasActivasEstudiante.length > 0) return error(MENSAJES.reservaActiva);
  if (datos.reservasAprobadasEquipo.some((r) => seCruzan(r, solicitud))) return error(MENSAJES.cruce);

  return { ok: true, ...solicitud };
}

/** HU-05: se penaliza cuando la devolución ocurre después de la hora de fin acordada. */
export function debePenalizar(finReserva, ahora) {
  return ahora > finReserva;
}

export function estaBloqueado(intento, ahora) {
  return Boolean(intento?.bloqueadoHasta) && intento.bloqueadoHasta > ahora;
}

/** HU-01: registra un intento fallido; al tercero consecutivo bloquea la cuenta MINUTOS_BLOQUEO minutos. */
export function registrarFallo(intento, ahora) {
  const fallos = (intento?.fallos ?? 0) + 1;
  const bloqueado = fallos >= MAX_INTENTOS;
  return {
    fallos: bloqueado ? 0 : fallos,
    bloqueadoHasta: bloqueado ? ahora + MINUTOS_BLOQUEO * MS_POR_MINUTO : null,
    bloqueado
  };
}

/** Normaliza el correo para usarlo como identificador de documento (debe coincidir con firestore.rules). */
export function claveCorreo(correo) {
  return correo.trim().toLowerCase().replaceAll(/[^a-z0-9]/g, "_");
}
