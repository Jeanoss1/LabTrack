// Modelo Equipo: colección "equipos"
import { db } from "../database.js";
import { collection, getDocs, query, orderBy, doc } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

export const COLECCION_EQUIPOS = "equipos";

export function referencia(id) {
  return doc(db, COLECCION_EQUIPOS, id);
}

export async function listarEquipos() {
  const snap = await getDocs(query(collection(db, COLECCION_EQUIPOS), orderBy("codigo")));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}
