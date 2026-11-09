// Modelo Usuario: colección "usuarios"
import { db } from "../database.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

export const COLECCION_USUARIOS = "usuarios";

export function referencia(uid) {
  return doc(db, COLECCION_USUARIOS, uid);
}

export async function obtenerPerfil(uid) {
  const snap = await getDoc(referencia(uid));
  return snap.exists() ? snap.data() : null;
}

/** Los perfiles nuevos siempre nacen como estudiante activo (las reglas de Firestore lo exigen). */
export async function crearPerfil(uid, { nombre, codigo, correo }) {
  const perfil = { nombre, codigo, correo, rol: "estudiante", estado: "Activo", creado: Date.now() };
  await setDoc(referencia(uid), perfil);
  return perfil;
}
