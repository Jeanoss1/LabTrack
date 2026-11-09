// Controlador de autenticación (HU-01): inicio de sesión, registro, Google y completar perfil
import { auth, proveedorGoogle } from "../oauth.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup,
  updateProfile, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { obtenerPerfil, crearPerfil } from "../models/Usuario.js";
import { obtenerIntento, guardarIntento, limpiarIntentos } from "../models/IntentoLogin.js";
import { estaBloqueado, registrarFallo, MINUTOS_BLOQUEO } from "../servicios/reglas.js";
import { mostrarMensaje, manejar } from "../static/js/ui.js";
import { RUTAS, rutaSegunRol } from "../static/js/sesion.js";

const MSG_CREDENCIALES = "Credenciales inválidas";
const MSG_BLOQUEO = `Alerta de seguridad: la cuenta está bloqueada temporalmente por 3 intentos fallidos. Intenta nuevamente en ${MINUTOS_BLOQUEO} minutos.`;
const ERRORES_REGISTRO = {
  "auth/email-already-in-use": "El correo ya está registrado.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/invalid-email": "El correo no tiene un formato válido."
};

const valor = (id) => document.getElementById(id).value.trim();

async function continuarConUsuario(user) {
  const perfil = await obtenerPerfil(user.uid);
  window.location.href = perfil ? rutaSegunRol(perfil) : RUTAS.completarPerfil;
}

// ---- Inicio de sesión con correo y contraseña ----
async function iniciarSesion(evento) {
  evento.preventDefault();
  const correo = valor("login-correo");
  const clave = document.getElementById("login-clave").value;
  const boton = document.getElementById("btn-login");
  boton.disabled = true;
  try {
    const intento = await obtenerIntento(correo);
    if (estaBloqueado(intento, Date.now())) {
      mostrarMensaje("login-mensaje", MSG_BLOQUEO, "alerta");
      return;
    }
    try {
      const cred = await signInWithEmailAndPassword(auth, correo, clave);
      await limpiarIntentos(correo);
      await continuarConUsuario(cred.user);
    } catch (err) {
      console.info("Ingreso rechazado:", err.code);
      const nuevo = registrarFallo(intento, Date.now());
      await guardarIntento(correo, nuevo);
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
  const correo = valor("reg-correo");
  const clave = document.getElementById("reg-clave").value;
  try {
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
    manejar(
      crearPerfil(usuarioGoogle.uid, datos).then((perfil) => { window.location.href = rutaSegunRol(perfil); }),
      "perfil-mensaje",
      "No se pudo guardar el perfil."
    );
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
