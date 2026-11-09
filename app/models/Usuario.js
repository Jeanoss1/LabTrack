// Modelo Usuario: colecciones "usuarios" y "codigos" (índice código de estudiante -> correo, HU-01)
import { db } from "../database.js";
import { doc, getDoc, writeBatch } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

export const COLECCION_USUARIOS = "usuarios";
const COLECCION_CODIGOS = "codigos";

export function referencia(uid) {
  return doc(db, COLECCION_USUARIOS, uid);
}

export async function obtenerPerfil(uid) {
  const snap = await getDoc(referencia(uid));
  return snap.exists() ? snap.data() : null;
}

/** Devuelve el correo asociado a un código de estudiante, o null si no existe. */
export async function correoPorCodigo(codigo) {
  const snap = await getDoc(doc(db, COLECCION_CODIGOS, codigo));
  return snap.exists() ? snap.data().correo : null;
}

export async function codigoDisponible(codigo) {
  return (await correoPorCodigo(codigo)) === null;
}

/**
 * Crea el perfil del estudiante y registra su código para poder ingresar con él.
 * Los perfiles nuevos siempre nacen como estudiante activo (las reglas de Firestore lo exigen).
 */
export async function crearPerfil(uid, { nombre, codigo, correo }) {
  const perfil = { nombre, codigo, correo, rol: "estudiante", estado: "Activo", creado: Date.now() };
  const lote = writeBatch(db);
  lote.set(referencia(uid), perfil);
  lote.set(doc(db, COLECCION_CODIGOS, codigo), { correo, uid });
  await lote.commit();
  return perfil;
}
