# 🏗️ RESUMEN DE IMPLEMENTACIÓN TÉCNICA

Este documento detalla la arquitectura y las decisiones técnicas tomadas en el desarrollo de TimeBill Pro.

## 🛠️ Arquitectura del Sistema

La aplicación sigue un modelo **SPA (Single Page Application)** con un backend **Serverless** basado en Google Apps Script.

### Componentes:
- **Frontend:** HTML5, CSS3 (Tailwind CSS), Vanilla JavaScript (ES6+).
- **Backend:** Google Apps Script (JavaScript de servidor).
- **Base de Datos:** Google Sheets (Hojas de cálculo como base de datos relacional simple).

## 📡 Flujo de Datos

1. **Petición del Cliente:** El frontend envía un `POST` o `GET` al `appScriptUrl`.
2. **Procesamiento Backend:** `doPost(e)` o `doGet(e)` recibe la acción y los datos.
3. **Persistencia:** GAS interactúa con la Spreadsheet ID configurada para leer o escribir filas.
4. **Respuesta:** El backend devuelve un objeto JSON con el estado de la operación y los datos resultantes.

## 🔐 Seguridad

### Autenticación
- Las contraseñas se procesan mediante un algoritmo de **hashing SHA-256**.
- Se utiliza un **Salt** aleatorio de 16 caracteres para cada usuario, almacenado en la base de datos, para prevenir ataques de tablas arcoíris.
- La comunicación se realiza sobre HTTPS.

### Control de Acceso
- El frontend gestiona la visibilidad de los elementos según el `userRole`.
- El backend está diseñado para manejar acciones específicas (`create_user`, `delete_user`) que idealmente deberían ser validadas en el servidor (implementación simplificada en esta versión).

## 📋 Estructura Final de Datos (Google Sheets)

### Hoja: Usuarios
| Columna | Descripción |
|---------|-------------|
| ID | Identificador único numérico |
| Email | Correo electrónico (Login ID) |
| Contraseña (Hash) | Hash SHA-256 de la contraseña + Salt |
| Salt | Cadena aleatoria única por usuario |
| Nombre | Nombre completo del usuario |
| Rol | 'Admin' o 'Usuario' |
| Fecha Registro | Timestamp de creación |

### Hoja: Clientes
| Columna | Descripción |
|---------|-------------|
| ID | Identificador del cliente |
| Nombre | Nombre o Razón Social |
| Email | Email de contacto para facturación |
| Teléfono | Número de contacto (usado para WhatsApp) |
| Dirección | Dirección física (opcional) |

### Hoja: Sesiones
| Columna | Descripción |
|---------|-------------|
| ID | Identificador de la sesión |
| Fecha | Fecha de la actividad |
| Hora Inicio | Hora de comienzo |
| Hora Fin | Hora de finalización |
| Cliente | Nombre del cliente asociado |
| Duración | Horas totales (decimal) |
| Total | Cálculo final (Duración * Valor/Hora) |

---
*TimeBill Pro v2.1 - Documentación Técnica*
