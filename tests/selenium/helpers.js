import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import fs from "node:fs";
import path from "node:path";

if (fs.existsSync(".env")) process.loadEnvFile(".env");

export const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const CARPETA_CAPTURAS = path.resolve("tests/selenium/capturas");

export async function crearDriver() {
  const opciones = new chrome.Options().addArguments("--window-size=1366,850", "--lang=es-PE");
  if (process.env.HEADLESS !== "false") opciones.addArguments("--headless=new");
  const builder = new Builder().forBrowser("chrome").setChromeOptions(opciones);
  if (process.env.CHROMEDRIVER) builder.setChromeService(new chrome.ServiceBuilder(process.env.CHROMEDRIVER));
  const driver = await builder.build();
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: 30000 });
  return driver;
}

export async function capturar(driver, nombre) {
  fs.mkdirSync(CARPETA_CAPTURAS, { recursive: true });
  const img = await driver.takeScreenshot();
  fs.writeFileSync(path.join(CARPETA_CAPTURAS, nombre + ".png"), img, "base64");
}

export async function esperar(driver, css, ms = 20000) {
  const el = await driver.wait(until.elementLocated(By.css(css)), ms);
  await driver.wait(until.elementIsVisible(el), ms);
  return el;
}

export async function esperarTexto(driver, css, texto, ms = 20000) {
  await driver.wait(async () => {
    const els = await driver.findElements(By.css(css));
    for (const el of els) {
      if ((await el.getText()).includes(texto)) return true;
    }
    return false;
  }, ms, `No apareció el texto "${texto}" en ${css}`);
  return (await driver.findElement(By.css(css))).getText();
}

export async function escribir(driver, css, valor) {
  const el = await esperar(driver, css);
  await el.clear();
  await el.sendKeys(valor);
}

// Los campos date/time dependen del idioma del navegador; se asigna el valor ISO directamente
export async function asignarValor(driver, css, valor) {
  await driver.executeScript(
    "const el = document.querySelector(arguments[0]); el.value = arguments[1]; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true}));",
    css, valor
  );
}

export async function iniciarSesion(driver, correo, clave) {
  await driver.get(BASE_URL + "/");
  await escribir(driver, "#login-correo", correo);
  await escribir(driver, "#login-clave", clave);
  await driver.findElement(By.css("#btn-login")).click();
}

export async function cerrarSesion(driver) {
  const salir = await esperar(driver, "#btn-salir");
  await salir.click();
  await driver.wait(until.urlIs(BASE_URL + "/"), 15000);
}

export function fechaISO(dias) {
  const d = new Date(Date.now() + dias * 24 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export { By, until };
