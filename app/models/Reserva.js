// Modelo Reserva: colección "reservas"
import { db } from "../database.js";
import {
  collection, getDocs, doc, addDoc, updateDoc, query, where, orderBy, writeBatch
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { referencia as refEquipo } from "./Equipo.js";
import { referencia as refUsuario } from "./Usuario.js";

function aLista(snap) {
  var lista = [];
  snap.forEach(function (d) {
    var r = d.data();
    r.id = d.id;
    lista.push(r);
  });
  return lista;
}

export async function reservasDeEstudiante(uid) {
  return aLista(await getDocs(query(collection(db, "reservas"), where("estudianteId", "==", uid), orderBy("creado", "desc"))));
}

export async function reservasActivasDeEstudiante(uid) {
  return aLista(await getDocs(query(collection(db, "reservas"), where("estudianteId", "==", uid), where("estado", "in", ["Pendiente", "Aprobada"]))));
}

export async function reservasAprobadasDeEquipo(equipoId) {
  return aLista(await getDocs(query(collection(db, "reservas"), where("equipoId", "==", equipoId), where("estado", "==", "Aprobada"))));
}

export async function reservasPendientes() {
  return aLista(await getDocs(query(collection(db, "reservas"), where("estado", "==", "Pendiente"), orderBy("creado"))));
}

export async function reservasAprobadas() {
  return aLista(await getDocs(query(collection(db, "reservas"), where("estado", "==", "Aprobada"), orderBy("inicio"))));
}

export async function crearReserva(datos) {
  datos.estado = "Pendiente";
  datos.creado = Date.now();
  return addDoc(collection(db, "reservas"), datos);
}

export async function aprobarReserva(reserva) {
  var batch = writeBatch(db);
  batch.update(doc(db, "reservas", reserva.id), { estado: "Aprobada", aprobadoEn: Date.now() });
  batch.update(refEquipo(reserva.equipoId), { estado: "Prestado" });
  await batch.commit();
}

export async function rechazarReserva(id, motivo) {
  await updateDoc(doc(db, "reservas", id), { estado: "Rechazada", motivoRechazo: motivo, rechazadoEn: Date.now() });
}

export async function registrarDevolucion(reserva, ahora, tarde) {
  var batch = writeBatch(db);
  batch.update(doc(db, "reservas", reserva.id), { estado: "Devuelta", devueltoEn: ahora, penalizado: tarde });
  batch.update(refEquipo(reserva.equipoId), { estado: "Disponible" });
  if (tarde) {
    batch.update(refUsuario(reserva.estudianteId), { estado: "Penalizado" });
  }
  await batch.commit();
}
