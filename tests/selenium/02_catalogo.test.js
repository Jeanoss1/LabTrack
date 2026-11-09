import assert from "node:assert/strict";
import { crearDriver, capturar, esperar, esperarTexto, iniciarSesion, By, until } from "./helpers.js";
import { resetear, usuarios, borrarCategoria, sembrarEquipos } from "../../seed.js";

const [ana] = usuarios.estudiantes;

async function filasVisibles(driver) {
  await driver.wait(async () => (await driver.findElements(By.css("#cuerpo-equipos tr[data-codigo]"))).length > 0
    || (await driver.findElement(By.css("#mensaje-vacio")).isDisplayed()), 20000);
  return driver.findElements(By.css("#cuerpo-equipos tr[data-codigo]"));
}

describe("HU-02 Catálogo y filtrado de equipos", function () {
  let driver;

  before(async function () {
    await resetear();
    driver = await crearDriver();
    await iniciarSesion(driver, ana.correo, ana.clave);
    await driver.wait(until.urlContains("/catalogo"), 20000);
  });

  after(async function () {
    await sembrarEquipos(["Redes"]);
    if (driver) await driver.quit();
  });

  it("TC-06 El catálogo muestra nombre, código de inventario, categoría y estado", async function () {
    const filas = await filasVisibles(driver);
    assert.equal(filas.length, 12);
    const encabezados = await Promise.all((await driver.findElements(By.css("#tabla-equipos th"))).map(th => th.getText()));
    for (const col of ["Equipo", "Código de inventario", "Categoría", "Estado"]) {
      assert.ok(encabezados.includes(col), "Falta la columna " + col);
    }
    const primera = await filas[0].getText();
    assert.match(primera, /CMP-001/);
    assert.match(primera, /Disponible/);
    await capturar(driver, "TC-06_catalogo_completo");
  });

  it("TC-07 El filtro 'Redes' muestra solo equipos de esa categoría", async function () {
    await driver.findElement(By.css("button[data-categoria='Redes']")).click();
    const filas = await filasVisibles(driver);
    assert.equal(filas.length, 4);
    for (const f of filas) {
      assert.match(await f.getText(), /Redes/);
    }
    await capturar(driver, "TC-07_filtro_redes");
  });

  it("TC-08 Mensaje cuando la categoría filtrada no tiene equipos", async function () {
    await borrarCategoria("Redes");
    await driver.navigate().refresh();
    await esperar(driver, "#cuerpo-equipos tr[data-codigo]");
    await driver.findElement(By.css("button[data-categoria='Redes']")).click();
    const texto = await esperarTexto(driver, "#mensaje-vacio", "No hay equipos");
    assert.equal(texto, "No hay equipos disponibles en esta categoría");
    await capturar(driver, "TC-08_categoria_sin_equipos");
  });
});
