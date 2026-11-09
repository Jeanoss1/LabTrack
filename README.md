# LabTrack – Sistema de gestión de préstamos de laboratorio

Proyecto del curso **Calidad y Pruebas de Software** (UPN, 2026-2). Aplicación web en HTML, CSS y JavaScript que usa **Firebase**: Authentication con correo y Google, Cloud Firestore y Hosting.

## Arquitectura (Modelo – Vista – Controlador)

Sigue la misma organización que el proyecto Web---Dino (Flask), pero adaptada a una aplicación Firebase del lado del cliente:

```
LabTrack/
├── app/                        # Carpeta publicada en Firebase Hosting
│   ├── models/                 # MODELO: acceso a Cloud Firestore
│   │   ├── Usuario.js
│   │   ├── Equipo.js
│   │   ├── Reserva.js
│   │   └── IntentoLogin.js
│   ├── views/                  # VISTA: páginas HTML
│   │   ├── iniciar_sesion.html
│   │   ├── registro.html
│   │   ├── completar_perfil.html
│   │   ├── catalogo.html
│   │   ├── mis_reservas.html
│   │   └── admin_reservas.html
│   ├── controllers/            # CONTROLADOR: eventos de la vista + modelo + reglas
│   │   ├── auth_controller.js
│   │   ├── catalogo_controller.js
│   │   ├── reserva_controller.js
│   │   └── admin_controller.js
│   ├── servicios/reglas.js     # Reglas de negocio puras (sin Firebase)
│   ├── static/                 # css, img, js compartido
│   ├── database.js             # Inicialización de Firebase y Firestore
│   ├── oauth.js                # Firebase Authentication (correo y Google)
│   └── firebase-config.js
├── tests/
│   ├── unit/                   # Pruebas unitarias (node:test)
│   ├── seguridad/              # Pruebas de reglas de Firestore
│   ├── selenium/               # Pruebas E2E: Selenium WebDriver + Mocha
│   └── jmeter/                 # Prueba de carga (.jmx)
├── seed.js                     # Carga y reinicio de datos de prueba
├── firestore.rules             # Reglas de seguridad
├── firestore.indexes.json
└── firebase.json               # Hosting: rutas limpias hacia app/views
```

## Rutas y funcionalidades

| Ruta | Vista | HU |
|------|-------|----|
| `/` | iniciar_sesion.html | HU-01: ingreso con código de estudiante o correo, y con Google; "Credenciales inválidas"; bloqueo tras 3 intentos |
| `/registro`, `/completar-perfil` | registro.html, completar_perfil.html | HU-01: registro de estudiantes |
| `/catalogo` | catalogo.html | HU-02: catálogo y filtros Cómputo / Electrónica / Redes |
| `/mis-reservas` | mis_reservas.html | HU-03: reserva con fecha y horario, sin cruces, una reserva activa |
| `/admin` | admin_reservas.html | HU-04 y HU-05: aprobar, rechazar con motivo, devolución y penalización |

## Puesta en marcha

1. Crear el proyecto en Firebase y activar **Authentication**: los proveedores Correo/contraseña y Google.
2. Crear la base de datos **Cloud Firestore**.
3. Copiar la configuración web del proyecto en `app/firebase-config.js`.
4. Instalar las dependencias: `npm install`
5. Copiar `.env.example` como `.env` y completar las credenciales de prueba
6. Cargar los datos de prueba: `npm run seed`
7. Levantar el sitio en local: `npm start` (http://localhost:5000)
8. Publicar: `npx firebase-tools deploy`

## Pruebas

```bash
npm run test:unit            # 18 pruebas unitarias de las reglas de negocio
npm run test:seguridad       # 8 pruebas de las reglas de seguridad de Firestore
npm run test:e2e             # 20 casos E2E con Selenium (Chrome)
npm run test:e2e:testomat    # igual que la anterior, pero envía los resultados a Testomat.io (variable TESTOMATIO)
```

Para la prueba de carga: `tests/jmeter/ejecutar.ps1 -Usuarios 50 -Proyecto <id> -HostWeb <id>.web.app`

## Integrantes

- ALTAMIRANO SANCHEZ, Jean Pierre
- CHAVEZ HUAMAN, Santos Roel
- GOICOCHEA GARCIA, Fredy Ruben
- MEDINA ATALAYA, Edmar Arlen
- RAMIREZ VASQUEZ, Theylor Kener
