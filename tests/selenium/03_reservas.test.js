import assert from "node:assert/strict";
import {
  crearDriver, capturar, esperar, esperarTexto, asignarValor, iniciarSesion, fechaISO, BASE_URL, By, until
} from "./helpers.js";
import { resetear, usuarios } from "../../seed.js";

const [ana] = usuarios.estudiantes;
const MANANA = fechaISO(1);

async function llenarReserva(driver, codigo, fecha, inicio, fin) {
  await driver.get(BASE_URL + "/mis-reservas");
  await driver.wait(async () => (await driver.findElements(By.css(`#res-equipo option[value='${codigo}']`))).length > 0, 20000);
  await driver.findElement(By.css(`#res-equipo option[value='${codigo}']`)).click();
  await asignarValor(driver, "#res-fecha", fecha);
  await asignarValor(driver, "#res-inicio", inicio);
  await asignarValor(driver, "#res-fin", fin);
}

describe("HU-03 Reserva de equipos (flujo crítico)", function () {
  let driver;

  before(async function () {
    await resetear();
    driver = await crearDriver();
    await iniciarSesion(driver, ana.correo, ana.clave);
    await driver.wait(until.urlContains("/catalogo"), 20000);
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  it("TC-09 Validación: la hora de fin debe ser posterior a la de inicio", async function () {
    await llenarReserva(driver, "CMP-001", MANANA, "12:00", "10:00");
    await driver.findElement(By.css("#btn-reservar")).click();
    const texto = await esperarTexto(driver, "#reserva-mensaje", "posterior");
    assert.match(texto, /hora de fin debe ser posterior/);
    await capturar(driver, "TC-09_validacion_horario");
  });

  it("TC-10 Reserva exitosa de un equipo disponible con fecha y horario", async function () {
    await driver.get(BASE_URL + "/catalogo");
    const reservar = await esperar(driver, "tr[data-codigo='CMP-001'] a.btn");
    await reservar.click();
    await driver.wait(until.urlContains("/mis-reservas?equipo=CMP-001"), 15000);
    await llenarReserva(driver, "CMP-001", MANANA, "10:00", "12:00");
    await capturar(driver, "TC-10_formulario_reserva");
    await driver.findElement(By.css("#btn-reservar")).click();
    const texto = await esperarTexto(driver, "#reserva-mensaje", "registrada");
    assert.match(texto, /Pendiente/);
    const fila = await esperarTexto(driver, "#cuerpo-mis-reservas tr", "CMP-001");
    assert.match(fila, /Pendiente/);
    await capturar(driver, "TC-10_reserva_registrada");
  });

  it("TC-11 Regla: un estudiante no puede tener más de un equipo reservado a la vez", async function () {
    await llenarReserva(driver, "ELE-003", MANANA, "15:00", "16:00");
    await driver.findElement(By.css("#btn-reservar")).click();
    const texto = await esperarTexto(driver, "#reserva-mensaje", "Solo se permite una reserva activa");
    assert.match(texto, /Ya tienes un equipo reservado/);
    await capturar(driver, "TC-11_reserva_simultanea_bloqueada");
  });

  it("TC-12 Validación: no se permite reservar en una fecha pasada", async function () {
    await llenarReserva(driver, "ELE-001", fechaISO(-1), "10:00", "11:00");
    await driver.findElement(By.css("#btn-reservar")).click();
    const texto = await esperarTexto(driver, "#reserva-mensaje", "pasada");
    assert.match(texto, /fecha u hora pasada/);
  });
});
