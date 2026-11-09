// Modelo IntentoLogin: colección "intentosLogin" (control de intentos fallidos, HU-01)
import { db } from "../database.js";
import { doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { claveCorreo } from "../servicios/reglas.js";

export async function obtenerIntento(correo) {
  try {
    var snap = await getDoc(doc(db, "intentosLogin", claveCorreo(correo)));
    return snap.exists() ? snap.data() : null;
  } catch (err) {}
  return null;
}

export async function guardarIntento(correo, datos) {
  await setDoc(doc(db, "intentosLogin", claveCorreo(correo)), { fallos: datos.fallos, bloqueadoHasta: datos.bloqueadoHasta, actualizado: Date.now() });
}

export async function limpiarIntentos(correo) {
  try { await deleteDoc(doc(db, "intentosLogin", claveCorreo(correo))); } catch (err) {}
}
