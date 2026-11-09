// Modelo IntentoLogin: colección "intentosLogin" (control de intentos fallidos, HU-01)
import { db } from "../database.js";
import { doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { claveCorreo } from "../servicios/reglas.js";

function referencia(correo) {
  return doc(db, "intentosLogin", claveCorreo(correo));
}

export async function obtenerIntento(correo) {
  const snap = await getDoc(referencia(correo));
  return snap.exists() ? snap.data() : null;
}

export async function guardarIntento(correo, { fallos, bloqueadoHasta }) {
  await setDoc(referencia(correo), { fallos, bloqueadoHasta, actualizado: Date.now() });
}

/** Se ejecuta después de un ingreso correcto; un fallo aquí no debe impedir el acceso. */
export async function limpiarIntentos(correo) {
  try {
    await deleteDoc(referencia(correo));
  } catch (err) {
    console.warn("No se pudo reiniciar el contador de intentos:", err.code ?? err);
  }
}
