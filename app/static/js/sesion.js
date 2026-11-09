// Control de sesión compartido por las vistas protegidas (antes estaba duplicado en cada controlador)
import { auth } from "../../oauth.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { obtenerPerfil } from "../../models/Usuario.js";

export const RUTAS = Object.freeze({
  inicio: "/",
  completarPerfil: "/completar-perfil",
  catalogo: "/catalogo",
  admin: "/admin"
});

export function rutaSegunRol(perfil) {
  return perfil.rol === "admin" ? RUTAS.admin : RUTAS.catalogo;
}

/**
 * Verifica que exista una sesión con el rol indicado ("estudiante" o "admin").
 * Si no corresponde, redirige y la promesa nunca se resuelve.
 * @returns {Promise<{user: import("firebase/auth").User, perfil: object}>}
 */
export function protegerVista(rolRequerido) {
  return new Promise((resolver) => {
    const cancelar = onAuthStateChanged(auth, (user) => {
      cancelar();
      if (!user) {
        window.location.href = RUTAS.inicio;
        return;
      }
      obtenerPerfil(user.uid).then((perfil) => {
        if (!perfil) {
          window.location.href = RUTAS.completarPerfil;
        } else if (perfil.rol === rolRequerido) {
          resolver({ user, perfil });
        } else {
          window.location.href = rutaSegunRol(perfil);
        }
      }).catch((err) => {
        console.error(err);
        window.location.href = RUTAS.inicio;
      });
    });
  });
}

export function enlazarCerrarSesion() {
  document.getElementById("btn-salir").addEventListener("click", (evento) => {
    evento.preventDefault();
    signOut(auth)
      .catch((err) => console.error(err))
      .finally(() => { window.location.href = RUTAS.inicio; });
  });
}
