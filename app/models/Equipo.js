// Modelo Equipo: colección "equipos"
import { db } from "../database.js";
import { collection, getDocs, query, orderBy, doc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

export async function listarEquipos() {
  var snap = await getDocs(query(collection(db, "equipos"), orderBy("codigo")));
  var lista = [];
  snap.forEach(function (d) {
    var e = d.data();
    e.id = d.id;
    lista.push(e);
  });
  return lista;
}

export function referencia(id) {
  return doc(db, "equipos", id);
}
