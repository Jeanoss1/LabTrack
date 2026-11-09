// Reglas de negocio de LabTrack (sin dependencias de Firebase para poder probarlas)

export var CATEGORIAS = ["Cómputo", "Electrónica", "Redes"];
export var MAX_INTENTOS = 3;
export var MINUTOS_BLOQUEO = 5;

export function aMilisegundos(fecha, hora) {
  var partesF = fecha.split("-");
  var partesH = hora.split(":");
  var d = new Date(parseInt(partesF[0]), parseInt(partesF[1]) - 1, parseInt(partesF[2]), parseInt(partesH[0]), parseInt(partesH[1]), 0, 0);
  return d.getTime();
}

export function seCruzan(a, b) {
  return a.inicio < b.fin && b.inicio < a.fin;
}

export function filtrarPorCategoria(equipos, categoria) {
  var resultado = [];
  for (var i = 0; i < equipos.length; i++) {
    if (categoria == "Todos" || equipos[i].categoria == categoria) {
      resultado.push(equipos[i]);
    }
  }
  return resultado;
}

export function validarReserva(datos) {
  var temp = null;
  if (datos.estadoEstudiante == "Penalizado") {
    return { ok: false, error: "Tu cuenta está penalizada. No puedes realizar nuevas reservas." };
  } else {
    if (!datos.equipo) {
      return { ok: false, error: "Selecciona un equipo." };
    } else {
      if (!datos.fecha || !datos.horaInicio || !datos.horaFin) {
        return { ok: false, error: "Completa la fecha, la hora de inicio y la hora de fin." };
      } else {
        var inicio = aMilisegundos(datos.fecha, datos.horaInicio);
        var fin = aMilisegundos(datos.fecha, datos.horaFin);
        if (fin <= inicio) {
          return { ok: false, error: "La hora de fin debe ser posterior a la hora de inicio." };
        } else {
          if (inicio < datos.ahora) {
            return { ok: false, error: "No puedes reservar en una fecha u hora pasada." };
          } else {
            if (datos.reservasActivasEstudiante.length > 0) {
              return { ok: false, error: "Ya tienes un equipo reservado. Solo se permite una reserva activa a la vez." };
            } else {
              for (var i = 0; i < datos.reservasAprobadasEquipo.length; i++) {
                var r = datos.reservasAprobadasEquipo[i];
                if (r.inicio < fin && inicio < r.fin) {
                  return { ok: false, error: "El equipo ya tiene una reserva aprobada que se cruza con ese horario." };
                }
              }
              return { ok: true, inicio: inicio, fin: fin };
            }
          }
        }
      }
    }
  }
}

export function debePenalizar(finReserva, ahora) {
  if (ahora > finReserva) {
    return true;
  } else {
    return false;
  }
}

export function estaBloqueado(intento, ahora) {
  return intento != null && intento.bloqueadoHasta != null && intento.bloqueadoHasta > ahora;
}

export function registrarFallo(intento, ahora) {
  var fallos = (intento && intento.fallos ? intento.fallos : 0) + 1;
  var bloqueadoHasta = fallos >= MAX_INTENTOS ? ahora + MINUTOS_BLOQUEO * 60 * 1000 : null;
  return { fallos: fallos >= MAX_INTENTOS ? 0 : fallos, bloqueadoHasta: bloqueadoHasta, bloqueado: fallos >= MAX_INTENTOS };
}

export function claveCorreo(correo) {
  return correo.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}
