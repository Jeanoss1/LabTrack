import assert from "node:assert/strict";
import {
  crearDriver, capturar, esperar, esperarTexto, escribir, asignarValor, iniciarSesion, cerrarSesion, fechaISO, BASE_URL, By, until
} from "./helpers.js";
import {
  resetear, usuarios, crearReserva, crearReservaVencida, estadoEquipo, estadoEstudiante
} from "../../seed.js";

const [ana, luis, maria] = usuarios.estudiantes;
const admin = usuarios.admin;
const MANANA = fechaISO(1);

function hora(fecha, hhmm) {
  const [a, m, d] = fecha.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(a, m - 1, d, h, mi);
}

async function filaDe(driver, tabla, texto) {
  await esperarTexto(driver, `#${tabla} tr`, texto);
  for (const fila of await driver.findElements(By.css(`#${tabla} tr`))) {
    if ((await fila.getText()).includes(texto)) return fila;
  }
  throw new Error("No se encontró la fila " + texto);
}

// La tabla se vuelve a pintar tras cada acción; si la fila ubicada desaparece (stale element), se reintenta.
async function conReintento(accion, intentos = 5) {
  for (let i = 1; ; i++) {
    try {
      return await accion();
    } catch (e) {
      if (e.name !== "StaleElementReferenceError" || i >= intentos) throw e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}

const clicEnFila = (driver, tabla, texto, boton) =>
  conReintento(async () => (await filaDe(driver, tabla, texto)).findElement(By.css(boton)).click());

const textoDeFila = (driver, tabla, texto) =>
  conReintento(async () => (await filaDe(driver, tabla, texto)).getText());

describe("HU-04 y HU-05 Panel del encargado: aprobación, rechazo y devolución", function () {
  let driver;

  before(async function () {
    await resetear();
    await crearReserva(luis.correo, "RED-001", hora(MANANA, "09:00"), hora(MANANA, "11:00"));
    await crearReserva(ana.correo, "CMP-002", hora(MANANA, "09:00"), hora(MANANA, "11:00"));
    await crearReservaVencida(maria.correo, "ELE-002");
    driver = await crearDriver();
    await iniciarSesion(driver, admin.correo, admin.clave);
    await driver.wait(until.urlContains("/admin"), 20000);
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  it("TC-13 La tabla de pendientes muestra estudiante, equipo, fecha/hora y acciones", async function () {
    await esperarTexto(driver, "#cuerpo-pendientes", luis.nombre);
    const filas = await driver.findElements(By.css("#cuerpo-pendientes tr[data-id]"));
    assert.equal(filas.length, 3);
    const encabezados = await Promise.all((await driver.findElements(By.css("#tabla-pendientes th"))).map(th => th.getText()));
    assert.deepEqual(encabezados, ["Estudiante", "Equipo", "Fecha/Hora solicitada", "Acciones"]);
    const texto = await filas[0].getText();
    assert.match(texto, /Aprobar/);
    assert.match(texto, /Rechazar/);
    await capturar(driver, "TC-13_panel_pendientes");
  });

  it("TC-14 Rechazar exige un motivo obligatorio y registra el estado 'Rechazada'", async function () {
    await clicEnFila(driver, "cuerpo-pendientes", "RED-001", ".btn-rechazar");
    await esperar(driver, "#modal-rechazo.visible");
    await driver.findElement(By.css("#btn-confirmar-rechazo")).click();
    await esperarTexto(driver, "#rechazo-mensaje", "Debes ingresar el motivo");
    await capturar(driver, "TC-14_rechazo_sin_motivo");
    await escribir(driver, "#motivo-rechazo", "Equipo en mantenimiento");
    await driver.findElement(By.css("#btn-confirmar-rechazo")).click();
    const msg = await esperarTexto(driver, "#admin-mensaje", "rechazada");
    assert.match(msg, /Equipo en mantenimiento/);
    await capturar(driver, "TC-14_rechazo_con_motivo");
  });

  it("TC-15 Aprobar cambia la reserva a 'Aprobada' y el equipo a 'Prestado'", async function () {
    await clicEnFila(driver, "cuerpo-pendientes", "CMP-002", ".btn-aprobar");
    await esperarTexto(driver, "#admin-mensaje", "Prestado");
    assert.match(await textoDeFila(driver, "cuerpo-activas", "CMP-002"), /Aprobada/);
    assert.equal(await estadoEquipo("CMP-002"), "Prestado");
    await capturar(driver, "TC-15_aprobacion");
  });

  it("TC-16 Regla: se bloquea la reserva que se cruza con una reserva aprobada", async function () {
    const otro = await crearDriver();
    try {
      await iniciarSesion(otro, luis.correo, luis.clave);
      await otro.wait(until.urlContains("/catalogo"), 20000);
      await otro.get(BASE_URL + "/mis-reservas");
      await otro.wait(async () => (await otro.findElements(By.css("#res-equipo option[value='CMP-002']"))).length > 0, 20000);
      await otro.findElement(By.css("#res-equipo option[value='CMP-002']")).click();
      await asignarValor(otro, "#res-fecha", MANANA);
      await asignarValor(otro, "#res-inicio", "10:00");
      await asignarValor(otro, "#res-fin", "12:00");
      await otro.findElement(By.css("#btn-reservar")).click();
      const texto = await esperarTexto(otro, "#reserva-mensaje", "se cruza");
      assert.match(texto, /ya tiene una reserva aprobada/);
      await capturar(otro, "TC-16_cruce_de_horario");
    } finally {
      await otro.quit();
    }
  });

  it("TC-17 Devolución tardía: el estudiante pasa automáticamente a 'Penalizado'", async function () {
    await driver.navigate().refresh();
    await clicEnFila(driver, "cuerpo-pendientes", "ELE-002", ".btn-aprobar");
    await esperarTexto(driver, "#admin-mensaje", "ELE-002");
    await escribir(driver, "#buscar-activa", maria.codigo);
    await clicEnFila(driver, "cuerpo-activas", "ELE-002", ".btn-devolucion");
    const msg = await esperarTexto(driver, "#admin-mensaje", "Penalizado");
    assert.match(msg, /fuera de plazo/);
    await esperarTexto(driver, "#cuerpo-activas", "No hay reservas activas");
    await capturar(driver, "TC-17_devolucion_tardia_penalizado");
    assert.equal(await estadoEstudiante(maria.correo), "Penalizado");
    assert.equal(await estadoEquipo("ELE-002"), "Disponible");
  });

  it("TC-18 Devolución a tiempo: el equipo vuelve a 'Disponible' sin penalización", async function () {
    const buscar = await esperar(driver, "#buscar-activa");
    await buscar.clear();
    await escribir(driver, "#buscar-activa", "CMP-002");
    await clicEnFila(driver, "cuerpo-activas", "CMP-002", ".btn-devolucion");
    const msg = await esperarTexto(driver, "#admin-mensaje", "a tiempo");
    assert.match(msg, /Disponible/);
    await esperarTexto(driver, "#cuerpo-activas", "No hay reservas activas");
    await capturar(driver, "TC-18_devolucion_a_tiempo");
    assert.equal(await estadoEquipo("CMP-002"), "Disponible");
    assert.equal(await estadoEstudiante(ana.correo), "Activo");
    await cerrarSesion(driver);
  });
});
