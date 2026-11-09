import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  aMilisegundos, seCruzan, filtrarPorCategoria, validarReserva, debePenalizar,
  estaBloqueado, registrarFallo, claveCorreo
} from "../../app/servicios/reglas.js";

const EQUIPO = { id: "CMP-001", codigo: "CMP-001", nombre: "Laptop", categoria: "Cómputo", estado: "Disponible" };
const MANANA = (() => {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

function base(extra) {
  return {
    equipo: EQUIPO, fecha: MANANA, horaInicio: "10:00", horaFin: "12:00", ahora: Date.now(),
    reservasActivasEstudiante: [], reservasAprobadasEquipo: [], estadoEstudiante: "Activo", ...extra
  };
}

describe("HU-02 Catálogo: filtro por categoría", () => {
  const equipos = [
    { codigo: "CMP-001", categoria: "Cómputo" },
    { codigo: "ELE-001", categoria: "Electrónica" },
    { codigo: "RED-001", categoria: "Redes" }
  ];
  test("filtra de forma exacta por 'Redes'", () => {
    assert.deepEqual(filtrarPorCategoria(equipos, "Redes").map(e => e.codigo), ["RED-001"]);
  });
  test("'Todos' devuelve el catálogo completo", () => {
    assert.equal(filtrarPorCategoria(equipos, "Todos").length, 3);
  });
  test("categoría sin equipos devuelve lista vacía", () => {
    assert.equal(filtrarPorCategoria([], "Electrónica").length, 0);
  });
});

describe("HU-03 Reserva: validaciones y reglas de negocio", () => {
  test("reserva válida devuelve inicio y fin", () => {
    const r = validarReserva(base());
    assert.equal(r.ok, true);
    assert.equal(r.fin - r.inicio, 2 * 3600 * 1000);
  });
  test("rechaza hora de fin anterior o igual a la de inicio", () => {
    assert.equal(validarReserva(base({ horaFin: "10:00" })).ok, false);
  });
  test("rechaza reservas en el pasado", () => {
    assert.match(validarReserva(base({ fecha: "2020-01-01" })).error, /pasada/);
  });
  test("bloquea cruce con una reserva aprobada del mismo equipo", () => {
    const aprobada = { inicio: aMilisegundos(MANANA, "11:00"), fin: aMilisegundos(MANANA, "13:00") };
    assert.match(validarReserva(base({ reservasAprobadasEquipo: [aprobada] })).error, /se cruza/);
  });
  test("permite horario contiguo (fin = inicio de otra reserva)", () => {
    const aprobada = { inicio: aMilisegundos(MANANA, "12:00"), fin: aMilisegundos(MANANA, "13:00") };
    assert.equal(validarReserva(base({ reservasAprobadasEquipo: [aprobada] })).ok, true);
  });
  test("un estudiante no puede tener más de un equipo reservado", () => {
    assert.match(validarReserva(base({ reservasActivasEstudiante: [{ estado: "Pendiente" }] })).error, /una reserva activa/);
  });
  test("estudiante penalizado no puede reservar", () => {
    assert.match(validarReserva(base({ estadoEstudiante: "Penalizado" })).error, /penalizada/);
  });
  test("exige seleccionar un equipo", () => {
    assert.equal(validarReserva(base({ equipo: null })).ok, false);
  });
  test("seCruzan detecta solapamiento parcial", () => {
    assert.equal(seCruzan({ inicio: 1, fin: 5 }, { inicio: 4, fin: 8 }), true);
    assert.equal(seCruzan({ inicio: 1, fin: 4 }, { inicio: 4, fin: 8 }), false);
  });
});

describe("HU-05 Devolución: penalización automática", () => {
  test("penaliza si la devolución es posterior a la hora de fin", () => {
    assert.equal(debePenalizar(1000, 2000), true);
  });
  test("no penaliza si devuelve antes o a la hora", () => {
    assert.equal(debePenalizar(2000, 2000), false);
    assert.equal(debePenalizar(2000, 1000), false);
  });
});

describe("HU-01 Autenticación: bloqueo por intentos fallidos", () => {
  test("primer y segundo fallo no bloquean", () => {
    const f1 = registrarFallo(null, 0);
    const f2 = registrarFallo(f1, 0);
    assert.equal(f1.bloqueado, false);
    assert.equal(f2.fallos, 2);
    assert.equal(f2.bloqueado, false);
  });
  test("tercer fallo consecutivo bloquea por 5 minutos", () => {
    const f3 = registrarFallo({ fallos: 2 }, 1000);
    assert.equal(f3.bloqueado, true);
    assert.equal(f3.bloqueadoHasta, 1000 + 5 * 60 * 1000);
    assert.equal(estaBloqueado(f3, 2000), true);
    assert.equal(estaBloqueado(f3, 1000 + 5 * 60 * 1000 + 1), false);
  });
  test("normaliza la clave del correo", () => {
    assert.equal(claveCorreo(" Ana.Torres@LabTrack.pe "), "ana_torres_labtrack_pe");
  });
});
