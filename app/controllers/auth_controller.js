// Controlador de autenticación (HU-01): inicio de sesión, registro, Google y completar perfil
import { auth, proveedorGoogle } from "../oauth.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup,
  updateProfile, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { obtenerPerfil, crearPerfil } from "../models/Usuario.js";
import { obtenerIntento, guardarIntento, limpiarIntentos } from "../models/IntentoLogin.js";
import { estaBloqueado, registrarFallo, MINUTOS_BLOQUEO } from "../servicios/reglas.js";

var formLogin = document.getElementById("form-login");
var formRegistro = document.getElementById("form-registro");
var formPerfil = document.getElementById("form-perfil");

function mostrar(id, texto, tipo) {
  var el = document.getElementById(id);
  el.textContent = texto;
  el.className = "mensaje visible " + tipo;
}

function irAlPanel(perfil) {
  if (perfil.rol == "admin") {
    window.location.href = "/admin";
  } else {
    window.location.href = "/catalogo";
  }
}

async function continuarConUsuario(user) {
  var perfil = await obtenerPerfil(user.uid);
  if (perfil) {
    irAlPanel(perfil);
  } else {
    window.location.href = "/completar-perfil";
  }
}

// Inicio de sesión con correo y contraseña
if (formLogin) {
  formLogin.addEventListener("submit", async function (e) {
    e.preventDefault();
    var correo = document.getElementById("login-correo").value.trim();
    var clave = document.getElementById("login-clave").value;
    var boton = document.getElementById("btn-login");
    boton.disabled = true;

    var intento = await obtenerIntento(correo);
    if (estaBloqueado(intento, Date.now())) {
      mostrar("login-mensaje", "Alerta de seguridad: la cuenta está bloqueada temporalmente por 3 intentos fallidos. Intenta nuevamente en " + MINUTOS_BLOQUEO + " minutos.", "alerta");
      boton.disabled = false;
      return;
    }

    try {
      var cred = await signInWithEmailAndPassword(auth, correo, clave);
      await limpiarIntentos(correo);
      await continuarConUsuario(cred.user);
    } catch (err) {
      var nuevo = registrarFallo(intento, Date.now());
      await guardarIntento(correo, nuevo);
      if (nuevo.bloqueado) {
        mostrar("login-mensaje", "Alerta de seguridad: la cuenta está bloqueada temporalmente por 3 intentos fallidos. Intenta nuevamente en " + MINUTOS_BLOQUEO + " minutos.", "alerta");
      } else {
        mostrar("login-mensaje", "Credenciales inválidas", "error");
      }
    }
    boton.disabled = false;
  });

  // Inicio de sesión con Google
  document.getElementById("btn-google").addEventListener("click", async function () {
    try {
      var cred = await signInWithPopup(auth, proveedorGoogle);
      await continuarConUsuario(cred.user);
    } catch (err) {
      mostrar("login-mensaje", "No se pudo iniciar sesión con Google.", "error");
    }
  });
}

// Registro con correo y contraseña
if (formRegistro) {
  formRegistro.addEventListener("submit", async function (e) {
    e.preventDefault();
    var nombre = document.getElementById("reg-nombre").value.trim();
    var codigo = document.getElementById("reg-codigo").value.trim().toUpperCase();
    var correo = document.getElementById("reg-correo").value.trim();
    var clave = document.getElementById("reg-clave").value;
    try {
      var cred = await createUserWithEmailAndPassword(auth, correo, clave);
      await updateProfile(cred.user, { displayName: nombre });
      var perfil = await crearPerfil(cred.user.uid, nombre, codigo, correo);
      mostrar("reg-mensaje", "Cuenta creada correctamente. Redirigiendo...", "ok");
      setTimeout(function () { irAlPanel(perfil); }, 800);
    } catch (err) {
      if (err.code == "auth/email-already-in-use") {
        mostrar("reg-mensaje", "El correo ya está registrado.", "error");
      } else if (err.code == "auth/weak-password") {
        mostrar("reg-mensaje", "La contraseña debe tener al menos 6 caracteres.", "error");
      } else {
        mostrar("reg-mensaje", "No se pudo crear la cuenta: " + err.message, "error");
      }
    }
  });
}

// Completar perfil después del primer ingreso con Google
if (formPerfil) {
  var usuarioGoogle = null;
  onAuthStateChanged(auth, function (user) {
    if (!user) {
      window.location.href = "/";
      return;
    }
    usuarioGoogle = user;
    document.getElementById("perfil-correo").textContent = "Cuenta: " + user.email;
  });

  formPerfil.addEventListener("submit", async function (e) {
    e.preventDefault();
    var codigo = document.getElementById("perfil-codigo").value.trim().toUpperCase();
    if (!usuarioGoogle) return;
    var perfil = await crearPerfil(usuarioGoogle.uid, usuarioGoogle.displayName || usuarioGoogle.email, codigo, usuarioGoogle.email);
    irAlPanel(perfil);
  });
}
