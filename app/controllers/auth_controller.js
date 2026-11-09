// Controlador de autenticación (HU-01): inicio de sesión, registro, Google y completar perfil
import { auth, proveedorGoogle } from "../oauth.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup,
  updateProfile, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { obtenerPerfil, crearPerfil, correoPorCodigo, codigoDisponible } from "../models/Usuario.js";
import { obtenerIntento, guardarIntento, limpiarIntentos } from "../models/IntentoLogin.js";
import { estaBloqueado, registrarFallo, esCodigoEstudiante, normalizarCodigo, MINUTOS_BLOQUEO } from "../servicios/reglas.js";
import { mostrarMensaje, manejar } from "../static/js/ui.js";
import { RUTAS, rutaSegunRol } from "../static/js/sesion.js";

const MSG_CREDENCIALES = "Credenciales inválidas";
const MSG_BLOQUEO = `Alerta de seguridad: la cuenta está bloqueada temporalmente por 3 intentos fallidos. Intenta nuevamente en ${MINUTOS_BLOQUEO} minutos.`;
const ERRORES_REGISTRO = {
  "auth/email-already-in-use": "El correo ya está registrado.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/invalid-email": "El correo no tiene un formato válido.",
  "codigo-duplicado": "El código de estudiante ya está registrado."
};

const valor = (id) => document.getElementById(id).value.trim();

/** HU-01: el identificador puede ser el correo o el código de estudiante. */
async function resolverCorreo(identificador) {
  if (!esCodigoEstudiante(identificador)) return identificador;
  return correoPorCodigo(normalizarCodigo(identificador));
}

async function continuarConUsuario(user) {
  const perfil = await obtenerPerfil(user.uid);
  window.location.href = perfil ? rutaSegunRol(perfil) : RUTAS.completarPerfil;
}

// ---- Inicio de sesión con correo y contraseña ----
async function iniciarSesion(evento) {
  evento.preventDefault();
  const identificador = valor("login-correo");
  const clave = document.getElementById("login-clave").value;
  const boton = document.getElementById("btn-login");
  boton.disabled = true;
  try {
    const correo = await resolverCorreo(identificador);
    const cuenta = correo ?? identificador; // los intentos se cuentan por cuenta, se ingrese con correo o con código
    const intento = await obtenerIntento(cuenta);
    if (estaBloqueado(intento, Date.now())) {
      mostrarMensaje("login-mensaje", MSG_BLOQUEO, "alerta");
      return;
    }
    try {
      if (!correo) throw Object.assign(new Error("Código no registrado"), { code: "auth/invalid-credential" });
      const cred = await signInWithEmailAndPassword(auth, correo, clave);
      await limpiarIntentos(cuenta);
      await continuarConUsuario(cred.user);
    } catch (err) {
      console.info("Ingreso rechazado:", err.code);
      const nuevo = registrarFallo(intento, Date.now());
      await guardarIntento(cuenta, nuevo);
      mostrarMensaje("login-mensaje", nuevo.bloqueado ? MSG_BLOQUEO : MSG_CREDENCIALES, nuevo.bloqueado ? "alerta" : "error");
    }
  } finally {
    boton.disabled = false;
  }
}

async function iniciarConGoogle() {
  try {
    const cred = await signInWithPopup(auth, proveedorGoogle);
    await continuarConUsuario(cred.user);
  } catch (err) {
    console.info("Ingreso con Google cancelado o fallido:", err.code);
    mostrarMensaje("login-mensaje", "No se pudo iniciar sesión con Google.", "error");
  }
}

// ---- Registro con correo y contraseña ----
async function registrar(evento) {
  evento.preventDefault();
  const nombre = valor("reg-nombre");
  const codigo = valor("reg-codigo").toUpperCase();
  const correo = valor("reg-correo").toLowerCase();
  const clave = document.getElementById("reg-clave").value;
  try {
    if (!(await codigoDisponible(codigo))) throw Object.assign(new Error("Código duplicado"), { code: "codigo-duplicado" });
    const cred = await createUserWithEmailAndPassword(auth, correo, clave);
    await updateProfile(cred.user, { displayName: nombre });
    const perfil = await crearPerfil(cred.user.uid, { nombre, codigo, correo });
    mostrarMensaje("reg-mensaje", "Cuenta creada correctamente. Redirigiendo...", "ok");
    setTimeout(() => { window.location.href = rutaSegunRol(perfil); }, 800);
  } catch (err) {
    mostrarMensaje("reg-mensaje", ERRORES_REGISTRO[err.code] ?? "No se pudo crear la cuenta. Intenta nuevamente.", "error");
  }
}

// ---- Completar perfil después del primer ingreso con Google ----
function iniciarCompletarPerfil(formPerfil) {
  let usuarioGoogle = null;
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = RUTAS.inicio;
      return;
    }
    usuarioGoogle = user;
    document.getElementById("perfil-correo").textContent = `Cuenta: ${user.email}`;
  });

  formPerfil.addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (!usuarioGoogle) return;
    const datos = {
      nombre: usuarioGoogle.displayName || usuarioGoogle.email,
      codigo: valor("perfil-codigo").toUpperCase(),
      correo: usuarioGoogle.email
    };
    const guardar = async () => {
      if (!(await codigoDisponible(datos.codigo))) {
        mostrarMensaje("perfil-mensaje", ERRORES_REGISTRO["codigo-duplicado"], "error");
        return;
      }
      const perfil = await crearPerfil(usuarioGoogle.uid, datos);
      window.location.href = rutaSegunRol(perfil);
    };
    manejar(guardar(), "perfil-mensaje", "No se pudo guardar el perfil.");
  });
}

// ---- Enlace de eventos según la vista cargada ----
const formLogin = document.getElementById("form-login");
if (formLogin) {
  formLogin.addEventListener("submit", (e) => manejar(iniciarSesion(e), "login-mensaje", "No se pudo conectar con el servidor."));
  document.getElementById("btn-google").addEventListener("click", () => manejar(iniciarConGoogle(), "login-mensaje", "No se pudo iniciar sesión con Google."));
}

const formRegistro = document.getElementById("form-registro");
if (formRegistro) {
  formRegistro.addEventListener("submit", (e) => manejar(registrar(e), "reg-mensaje", "No se pudo crear la cuenta."));
}

const formPerfil = document.getElementById("form-perfil");
if (formPerfil) {
  iniciarCompletarPerfil(formPerfil);
}
