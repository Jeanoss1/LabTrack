import assert from "node:assert/strict";
import crypto from "node:crypto";
import { crearDriver, capturar, esperar, esperarTexto, escribir, iniciarSesion, cerrarSesion, BASE_URL, By, until } from "./helpers.js";
import { resetear, usuarios } from "../../seed.js";

const [ana, , maria] = usuarios.estudiantes;
const admin = usuarios.admin;

describe("HU-01 Autenticación segura", function () {
  let driver;

  before(async function () {
    await resetear();
    driver = await crearDriver();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  it("TC-01 Ingreso exitoso del estudiante con correo y contraseña válidos", async function () {
    await iniciarSesion(driver, ana.correo, ana.clave);
    await driver.wait(until.urlContains("/catalogo"), 20000);
    const nombre = await esperarTexto(driver, "#nombre-usuario", ana.codigo);
    assert.ok(nombre.includes(ana.nombre));
    await capturar(driver, "TC-01_login_exitoso");
    await cerrarSesion(driver);
  });

  it("TC-02 Mensaje 'Credenciales inválidas' con contraseña incorrecta", async function () {
    await iniciarSesion(driver, ana.correo, "ClaveIncorrecta1");
    const texto = await esperarTexto(driver, "#login-mensaje", "Credenciales inválidas");
    assert.equal(texto, "Credenciales inválidas");
    assert.ok((await driver.getCurrentUrl()) === BASE_URL + "/");
    await capturar(driver, "TC-02_credenciales_invalidas");
  });

  it("TC-03 Bloqueo temporal tras 3 intentos fallidos consecutivos", async function () {
    for (let i = 1; i <= 3; i++) {
      await iniciarSesion(driver, maria.correo, "Incorrecta" + i);
      if (i < 3) await esperarTexto(driver, "#login-mensaje", "Credenciales inválidas");
    }
    await esperarTexto(driver, "#login-mensaje", "bloqueada temporalmente");
    // aun con la clave correcta, la cuenta permanece bloqueada
    await iniciarSesion(driver, maria.correo, maria.clave);
    const alerta = await esperarTexto(driver, "#login-mensaje", "Alerta de seguridad");
    assert.match(alerta, /bloqueada temporalmente/);
    assert.ok((await driver.getCurrentUrl()) === BASE_URL + "/");
    await capturar(driver, "TC-03_bloqueo_3_intentos");
  });

  it("TC-04 Registro de un nuevo estudiante con correo y contraseña", async function () {
    const sufijo = Date.now();
    await driver.get(BASE_URL + "/");
    await (await esperar(driver, "#ir-registro")).click();
    await escribir(driver, "#reg-nombre", "Estudiante Prueba " + sufijo);
    await escribir(driver, "#reg-codigo", "N00" + String(sufijo).slice(-6));
    await escribir(driver, "#reg-correo", `qa.${sufijo}@labtrack.pe`);
    await escribir(driver, "#reg-clave", crypto.randomBytes(9).toString("base64url"));
    await capturar(driver, "TC-04_formulario_registro");
    await driver.findElement(By.css("#btn-registro")).click();
    await driver.wait(until.urlContains("/catalogo"), 20000);
    const nombre = await esperarTexto(driver, "#nombre-usuario", "Estudiante Prueba");
    assert.ok(nombre.includes(String(sufijo)), "El panel debe mostrar el nombre del estudiante registrado");
    assert.ok((await driver.getCurrentUrl()).endsWith("/catalogo"));
    await capturar(driver, "TC-04_registro_exitoso");
    await cerrarSesion(driver);
  });

  it("TC-05 El encargado ingresa directamente al panel de administración", async function () {
    await iniciarSesion(driver, admin.correo, admin.clave);
    await driver.wait(until.urlContains("/admin"), 20000);
    const tabla = await esperar(driver, "#tabla-pendientes");
    assert.ok(await tabla.isDisplayed());
    const nombre = await esperarTexto(driver, "#nombre-usuario", "Encargado");
    assert.match(nombre, /Carlos Mendoza/);
    await capturar(driver, "TC-05_login_encargado");
    await cerrarSesion(driver);
  });
});
