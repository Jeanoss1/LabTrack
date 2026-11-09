// Carga y reinicio de datos de prueba de LabTrack
// Uso: node seed.js          -> crea usuarios de prueba y equipos
//      node seed.js --reset  -> borra reservas e intentos y deja los equipos disponibles
// Las credenciales se leen de variables de entorno o del archivo .env (ver .env.example).
import fs from "node:fs";
import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "firebase/auth";
import {
  getFirestore, doc, setDoc, getDocs, collection, writeBatch, addDoc, getDoc, updateDoc
} from "firebase/firestore";
import { firebaseConfig } from "./app/firebase-config.js";

if (fs.existsSync(".env")) process.loadEnvFile(".env");

function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre} (revisa el archivo .env)`);
  return valor;
}

const ADMIN = {
  correo: requerida("ADMIN_EMAIL"), clave: requerida("ADMIN_PASSWORD"),
  nombre: "Carlos Mendoza (Encargado)", codigo: "ADM-001", rol: "admin"
};
const claveEstudiantes = requerida("EST_PASSWORD");
const ESTUDIANTES = [
  { correo: requerida("EST1_EMAIL"), nombre: "Ana Torres Díaz", codigo: "N00200001" },
  { correo: requerida("EST2_EMAIL"), nombre: "Luis Campos Rojas", codigo: "N00200002" },
  { correo: requerida("EST3_EMAIL"), nombre: "María Rojas Vega", codigo: "N00200003" }
].map((e) => ({ ...e, clave: claveEstudiantes, rol: "estudiante" }));

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

const dosDigitos = (n) => String(n).padStart(2, "0");
const aFecha = (d) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
const aHora = (d) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;

async function entrar(u, crearSiNoExiste = false) {
  await signOut(auth);
  try {
    return (await signInWithEmailAndPassword(auth, u.correo, u.clave)).user;
  } catch (e) {
    if (crearSiNoExiste && e.code === "auth/invalid-credential") {
      return (await createUserWithEmailAndPassword(auth, u.correo, u.clave)).user;
    }
    throw e;
  }
}

async function asegurarPerfil(u) {
  const user = await entrar(u, true);
  const ref = doc(db, "usuarios", user.uid);
  if (!(await getDoc(ref)).exists()) {
    await setDoc(ref, { nombre: u.nombre, codigo: u.codigo, correo: u.correo, rol: u.rol, estado: "Activo", creado: Date.now() });
  }
  return user.uid;
}

function equipoDisponible(e) {
  return { ...e, estado: "Disponible" };
}

export async function sembrarEquipos(categorias) {
  await entrar(ADMIN);
  const lote = writeBatch(db);
  EQUIPOS.filter((e) => !categorias || categorias.includes(e.categoria))
    .forEach((e) => lote.set(doc(db, "equipos", e.codigo), equipoDisponible(e)));
  await lote.commit();
}

export async function borrarCategoria(categoria) {
  await entrar(ADMIN);
  const lote = writeBatch(db);
  EQUIPOS.filter((e) => e.categoria === categoria).forEach((e) => lote.delete(doc(db, "equipos", e.codigo)));
  await lote.commit();
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
  const lote = writeBatch(db);
  (await getDocs(collection(db, "reservas"))).forEach((d) => lote.delete(d.ref));
  (await getDocs(collection(db, "intentosLogin"))).forEach((d) => lote.delete(d.ref));
  (await getDocs(collection(db, "usuarios"))).forEach((d) => {
    if (d.data().rol === "estudiante") lote.update(d.ref, { estado: "Activo" });
  });
  EQUIPOS.forEach((e) => lote.set(doc(db, "equipos", e.codigo), equipoDisponible(e)));
  await lote.commit();
  await signOut(auth);
}

/** Crea una solicitud de reserva pendiente a nombre de un estudiante. */
export async function crearReserva(correoEstudiante, codigoEquipo, inicio, fin) {
  const est = ESTUDIANTES.find((e) => e.correo === correoEstudiante);
  const equipo = EQUIPOS.find((e) => e.codigo === codigoEquipo);
  const user = await entrar(est);
  const ref = await addDoc(collection(db, "reservas"), {
    estudianteId: user.uid,
    estudianteNombre: est.nombre,
    estudianteCodigo: est.codigo,
    equipoId: equipo.codigo,
    equipoNombre: equipo.nombre,
    equipoCodigo: equipo.codigo,
    fecha: aFecha(inicio),
    horaInicio: aHora(inicio),
    horaFin: aHora(fin),
    inicio: inicio.getTime(),
    fin: fin.getTime(),
    estado: "Pendiente",
    creado: Date.now()
  });
  await signOut(auth);
  return ref.id;
}

/** Reserva que terminó hace una hora (para probar la penalización por devolución tardía). */
export function crearReservaVencida(correoEstudiante, codigoEquipo) {
  const fin = new Date(Date.now() - 60 * 60 * 1000);
  const inicio = new Date(fin.getTime() - 60 * 60 * 1000);
  return crearReserva(correoEstudiante, codigoEquipo, inicio, fin);
}

export async function estadoEstudiante(correoEstudiante) {
  await entrar(ADMIN);
  const snap = await getDocs(collection(db, "usuarios"));
  await signOut(auth);
  const encontrado = snap.docs.find((d) => d.data().correo === correoEstudiante);
  return encontrado ? encontrado.data().estado : null;
}

export async function fijarEstadoEstudiante(correoEstudiante, estado) {
  await entrar(ADMIN);
  const snap = await getDocs(collection(db, "usuarios"));
  const encontrado = snap.docs.find((d) => d.data().correo === correoEstudiante);
  if (encontrado) await updateDoc(encontrado.ref, { estado });
  await signOut(auth);
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
if (process.argv[1]?.endsWith("seed.js")) {
  const reset = process.argv.includes("--reset");
  try {
    const resultado = reset ? await resetear() : await sembrar();
    console.log(reset ? "Datos reiniciados." : "Datos cargados:", resultado ?? "");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
