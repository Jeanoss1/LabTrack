// Modelo Usuario: colección "usuarios"
import { db } from "../database.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

export async function obtenerPerfil(uid) {
  var snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? snap.data() : null;
}

export async function crearPerfil(uid, nombre, codigo, correo) {
  var perfil = { nombre: nombre, codigo: codigo, correo: correo, rol: "estudiante", estado: "Activo", creado: Date.now() };
  await setDoc(doc(db, "usuarios", uid), perfil);
  return perfil;
}

export function referencia(uid) {
  return doc(db, "usuarios", uid);
}
