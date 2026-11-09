// Carga y reinicio de datos de prueba de LabTrack
// Uso: node seed.js          -> crea usuarios de prueba y equipos
//      node seed.js --reset  -> borra reservas, intentos y deja los equipos disponibles
import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "firebase/auth";
import {
  getFirestore, doc, setDoc, getDocs, collection, writeBatch, addDoc, getDoc, updateDoc
} from "firebase/firestore";
import { firebaseConfig } from "./app/firebase-config.js";

const ADMIN = { correo: "encargado@labtrack.pe", clave: "Encargado2026", nombre: "Carlos Mendoza (Encargado)", codigo: "ADM-001", rol: "admin" };
const ESTUDIANTES = [
  { correo: "ana.torres@labtrack.pe", clave: "Estudiante2026", nombre: "Ana Torres Díaz", codigo: "N00200001", rol: "estudiante" },
  { correo: "luis.campos@labtrack.pe", clave: "Estudiante2026", nombre: "Luis Campos Rojas", codigo: "N00200002", rol: "estudiante" },
  { correo: "maria.rojas@labtrack.pe", clave: "Estudiante2026", nombre: "María Rojas Vega", codigo: "N00200003", rol: "estudiante" }
];

export const EQUIPOS = [
  { codigo: "CMP-001", nombre: "Laptop Lenovo ThinkPad E14", categoria: "Cómputo" },
  { codigo: "CMP-002", nombre: "PC Dell OptiPlex 7010", categoria: "Cómputo" },
  { codigo: "CMP-003", nombre: "Raspberry Pi 4 Model B (8 GB)", categoria: "Cómputo" },
  { codigo: "CMP-004", nombre: "Monitor LG 24\" Full HD", categoria: "Cómputo" },
  { codigo: "ELE-001", nombre: "Osciloscopio Rigol DS1054Z", categoria: "Electrónica" },
  { codigo: "ELE-002", nombre: "Multímetro digital Fluke 115", categoria: "Electrónica" },
  { codigo: "ELE-003", nombre: "Kit Arduino Uno R3", categoria: "Electrónica" },
  { codigo: "ELE-004", nombre: "Fuente de poder regulable 30V/5A", categoria: "Electrónica" },
  { codigo: "RED-001", nombre: "Router Cisco ISR 2911", categoria: "Redes" },
  { codigo: "RED-002", nombre: "Switch Cisco Catalyst 2960", categoria: "Redes" },
  { codigo: "RED-003", nombre: "Access Point Ubiquiti UniFi U6", categoria: "Redes" },
  { codigo: "RED-004", nombre: "Kit de crimpado y tester RJ45", categoria: "Redes" }
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const usuarios = { admin: ADMIN, estudiantes: ESTUDIANTES };

async function entrar(u) {
  await signOut(auth);
  try {
    return (await signInWithEmailAndPassword(auth, u.correo, u.clave)).user;
  } catch (e) {
    if (e.code === "auth/invalid-credential" || e.code === "auth/user-not-found") {
      return (await createUserWithEmailAndPassword(auth, u.correo, u.clave)).user;
    }
    throw e;
  }
}

async function asegurarPerfil(u) {
  const user = await entrar(u);
  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { nombre: u.nombre, codigo: u.codigo, correo: u.correo, rol: u.rol, estado: "Activo", creado: Date.now() });
  }
  return user.uid;
}

export async function sembrarEquipos(categorias) {
  await entrar(ADMIN);
  const batch = writeBatch(db);
  EQUIPOS.filter(e => !categorias || categorias.includes(e.categoria))
    .forEach(e => batch.set(doc(db, "equipos", e.codigo), { ...e, estado: "Disponible" }));
  await batch.commit();
}

export async function borrarCategoria(categoria) {
  await entrar(ADMIN);
  const batch = writeBatch(db);
  EQUIPOS.filter(e => e.categoria === categoria).forEach(e => batch.delete(doc(db, "equipos", e.codigo)));
  await batch.commit();
}

export async function sembrar() {
  const uids = {};
  for (const u of [ADMIN, ...ESTUDIANTES]) {
    uids[u.correo] = await asegurarPerfil(u);
  }
  await sembrarEquipos();
  await signOut(auth);
  return uids;
}

export async function resetear() {
  await entrar(ADMIN);
  const batch = writeBatch(db);
  (await getDocs(collection(db, "reservas"))).forEach(d => batch.delete(d.ref));
  (await getDocs(collection(db, "intentosLogin"))).forEach(d => batch.delete(d.ref));
  (await getDocs(collection(db, "usuarios"))).forEach(d => {
    if (d.data().rol === "estudiante") batch.update(d.ref, { estado: "Activo" });
  });
  EQUIPOS.forEach(e => batch.set(doc(db, "equipos", e.codigo), { ...e, estado: "Disponible" }));
  await batch.commit();
  await signOut(auth);
}

// Crea una reserva ya vencida (para probar la penalización por devolución tardía)
export async function crearReservaVencida(correoEstudiante, codigoEquipo) {
  const fin = new Date(Date.now() - 60 * 60 * 1000);
  const inicio = new Date(fin.getTime() - 60 * 60 * 1000);
  return crearReserva(correoEstudiante, codigoEquipo, inicio, fin);
}

// Crea una solicitud de reserva pendiente a nombre de un estudiante
export async function crearReserva(correoEstudiante, codigoEquipo, inicio, fin) {
  const est = ESTUDIANTES.find(e => e.correo === correoEstudiante);
  const user = await entrar(est);
  const equipo = EQUIPOS.find(e => e.codigo === codigoEquipo);
  const dosDig = n => String(n).padStart(2, "0");
  const fecha = `${inicio.getFullYear()}-${dosDig(inicio.getMonth() + 1)}-${dosDig(inicio.getDate())}`;
  const ref = await addDoc(collection(db, "reservas"), {
    estudianteId: user.uid,
    estudianteNombre: est.nombre,
    estudianteCodigo: est.codigo,
    equipoId: equipo.codigo,
    equipoNombre: equipo.nombre,
    equipoCodigo: equipo.codigo,
    fecha,
    horaInicio: `${dosDig(inicio.getHours())}:${dosDig(inicio.getMinutes())}`,
    horaFin: `${dosDig(fin.getHours())}:${dosDig(fin.getMinutes())}`,
    inicio: inicio.getTime(),
    fin: fin.getTime(),
    estado: "Pendiente",
    creado: Date.now()
  });
  await signOut(auth);
  return ref.id;
}

export async function estadoEstudiante(correoEstudiante) {
  await entrar(ADMIN);
  const snap = await getDocs(collection(db, "usuarios"));
  let estado = null;
  snap.forEach(d => { if (d.data().correo === correoEstudiante) estado = d.data().estado; });
  await signOut(auth);
  return estado;
}

export async function estadoEquipo(codigo) {
  const snap = await getDoc(doc(db, "equipos", codigo));
  return snap.exists() ? snap.data().estado : null;
}

export async function actualizarEquipo(codigo, datos) {
  await entrar(ADMIN);
  await updateDoc(doc(db, "equipos", codigo), datos);
  await signOut(auth);
}

// Ejecución directa desde la consola
if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  const reset = process.argv.includes("--reset");
  (reset ? resetear() : sembrar())
    .then(r => { console.log(reset ? "Datos reiniciados." : "Datos cargados:", r || ""); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
}
