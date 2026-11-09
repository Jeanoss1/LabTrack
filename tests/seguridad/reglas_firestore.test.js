// Pruebas de seguridad de las reglas de Firestore (se ejecutan contra el proyecto real)
// Uso: node --test tests/seguridad/reglas_firestore.test.js
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, updateDoc, setDoc, getDoc, addDoc, collection } from "firebase/firestore";
import { firebaseConfig } from "../../app/firebase-config.js";
import { usuarios, resetear, fijarEstadoEstudiante } from "../../seed.js";

const app = initializeApp(firebaseConfig, "pruebas-seguridad");
const auth = getAuth(app);
const db = getFirestore(app);
const [ana] = usuarios.estudiantes;

async function denegado(promesa) {
  await assert.rejects(promesa, (e) => e.code === "permission-denied");
}

describe("Reglas de seguridad de Firestore", () => {
  let uidAna;
  before(async () => {
    await resetear();
    uidAna = (await signInWithEmailAndPassword(auth, ana.correo, ana.clave)).user.uid;
  });
  after(async () => {
    await signOut(auth);
    await resetear();
  });

  test("SEC-01 un estudiante no puede asignarse el rol de administrador", async () => {
    await denegado(updateDoc(doc(db, "usuarios", uidAna), { rol: "admin" }));
  });

  test("SEC-02 un estudiante penalizado no puede quitarse la penalización", async () => {
    await fijarEstadoEstudiante(ana.correo, "Penalizado");
    await signInWithEmailAndPassword(auth, ana.correo, ana.clave);
    await denegado(updateDoc(doc(db, "usuarios", uidAna), { estado: "Activo" }));
    await fijarEstadoEstudiante(ana.correo, "Activo");
    await signInWithEmailAndPassword(auth, ana.correo, ana.clave);
  });

  test("SEC-03 un estudiante no puede cambiar el estado de un equipo", async () => {
    await denegado(updateDoc(doc(db, "equipos", "CMP-001"), { estado: "Disponible" }));
  });

  test("SEC-04 un estudiante no puede crear una reserva ya aprobada", async () => {
    await denegado(addDoc(collection(db, "reservas"), {
      estudianteId: uidAna, equipoId: "CMP-001", estado: "Aprobada", inicio: 1, fin: 2
    }));
  });

  test("SEC-05 un estudiante no puede aprobar su propia solicitud", async () => {
    const ref = await addDoc(collection(db, "reservas"), {
      estudianteId: uidAna, equipoId: "CMP-001", estado: "Pendiente", inicio: Date.now() + 3600e3, fin: Date.now() + 7200e3
    });
    await denegado(updateDoc(ref, { estado: "Aprobada" }));
  });

  test("SEC-06 un estudiante no puede leer el perfil de otro usuario", async () => {
    await denegado(getDoc(doc(db, "usuarios", "uid-de-otro-usuario")));
  });

  test("SEC-08 un estudiante no puede asociar un código de estudiante al correo de otra persona", async () => {
    await signInWithEmailAndPassword(auth, ana.correo, ana.clave);
    await denegado(setDoc(doc(db, "codigos", "N09999999"), { correo: "encargado@labtrack.pe", uid: uidAna }));
    await denegado(setDoc(doc(db, "codigos", ana.codigo), { correo: ana.correo, uid: "otro-uid" }));
  });

  test("SEC-07 sin sesión no se puede reiniciar el contador de una cuenta bloqueada", async () => {
    await signOut(auth);
    const ref = doc(db, "intentosLogin", "victima_labtrack_pe");
    await setDoc(ref, { fallos: 1, bloqueadoHasta: null, actualizado: Date.now() });
    await setDoc(ref, { fallos: 2, bloqueadoHasta: null, actualizado: Date.now() });
    await setDoc(ref, { fallos: 0, bloqueadoHasta: Date.now() + 5 * 60e3, actualizado: Date.now() });
    await denegado(setDoc(ref, { fallos: 0, bloqueadoHasta: null, actualizado: Date.now() }));
    await denegado(setDoc(ref, { fallos: 1, bloqueadoHasta: null, actualizado: Date.now() }));
  });
});
