// Autenticación: correo/contraseña y proveedor Google (equivalente a oauth.py)
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { app } from "./database.js";

export const auth = getAuth(app);
export const proveedorGoogle = new GoogleAuthProvider();
proveedorGoogle.setCustomParameters({ prompt: "select_account" });
