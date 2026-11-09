// Modelo Reserva: colección "reservas"
import { db } from "../database.js";
import {
  collection, getDocs, doc, addDoc, updateDoc, query, where, orderBy, writeBatch
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { referencia as refEquipo } from "./Equipo.js";
import { referencia as refUsuario } from "./Usuario.js";

const reservas = collection(db, "reservas");

export const ESTADOS = Object.freeze({
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  devuelta: "Devuelta"
});

async function consultar(...restricciones) {
  const snap = await getDocs(query(reservas, ...restricciones));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export function reservasDeEstudiante(uid) {
  return consultar(where("estudianteId", "==", uid), orderBy("creado", "desc"));
}

export function reservasActivasDeEstudiante(uid) {
  return consultar(where("estudianteId", "==", uid), where("estado", "in", [ESTADOS.pendiente, ESTADOS.aprobada]));
}

export function reservasAprobadasDeEquipo(equipoId) {
  return consultar(where("equipoId", "==", equipoId), where("estado", "==", ESTADOS.aprobada));
}

export function reservasPendientes() {
  return consultar(where("estado", "==", ESTADOS.pendiente), orderBy("creado"));
}

export function reservasAprobadas() {
  return consultar(where("estado", "==", ESTADOS.aprobada), orderBy("inicio"));
}

export function crearReserva(datos) {
  return addDoc(reservas, { ...datos, estado: ESTADOS.pendiente, creado: Date.now() });
}

export async function aprobarReserva(reserva) {
  const lote = writeBatch(db);
  lote.update(doc(reservas, reserva.id), { estado: ESTADOS.aprobada, aprobadoEn: Date.now() });
  lote.update(refEquipo(reserva.equipoId), { estado: "Prestado" });
  await lote.commit();
}

export function rechazarReserva(id, motivo) {
  return updateDoc(doc(reservas, id), { estado: ESTADOS.rechazada, motivoRechazo: motivo, rechazadoEn: Date.now() });
}

export async function registrarDevolucion(reserva, ahora, tarde) {
  const lote = writeBatch(db);
  lote.update(doc(reservas, reserva.id), { estado: ESTADOS.devuelta, devueltoEn: ahora, penalizado: tarde });
  lote.update(refEquipo(reserva.equipoId), { estado: "Disponible" });
  if (tarde) {
    lote.update(refUsuario(reserva.estudianteId), { estado: "Penalizado" });
  }
  await lote.commit();
}
