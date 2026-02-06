# 🏗️ RESUMEN DE IMPLEMENTACIÓN TÉCNICA

## 🛠️ Arquitectura
TimeBill Pro es una aplicación web tipo **SPA (Single Page Application)** que utiliza una arquitectura sin servidor apoyada en el ecosistema de Google.

- **Frontend**: HTML5, CSS3 (Tailwind CSS via CDN), y JavaScript Vanilla.
- **Backend**: Google Apps Script (GAS) actuando como una API RESTful.
- **Persistencia**: Google Sheets como base de datos relacional simplificada.

## 📡 Flujo de Datos
1. El usuario interactúa con la interfaz (ej. detiene un timer).
2. El frontend realiza una petición `fetch` (POST) al endpoint de GAS.
3. El script de GAS procesa la acción (ej. `save_session`) y escribe en la hoja correspondiente.
4. GAS responde con un JSON indicando éxito o error.
5. El frontend actualiza la UI y muestra notificaciones (Toast).

## 🗃️ Estructura de la Base de Datos (Google Sheets)
- **Usuarios**: `ID, Email, Contraseña (Hash), Nombre, Rol, Fecha Registro, ...`
- **Sesiones**: `ID, Fecha, Hora Inicio, Hora Fin, Cliente, Email Cliente, Duración, Valor/Hora, Total, Estado`
- **Clientes**: `ID, Nombre, Email, Teléfono, Dirección, Fecha Creación, Estado`
- **Configuración**: `Parámetro, Valor, Tipo, Descripción`

## 🔒 Seguridad
- Comunicación segura HTTPS a través de los servidores de Google.
- Las contraseñas se almacenan como hashes SHA-256, nunca en texto plano.
- Los roles ('Admin' vs 'Usuario') controlan la visibilidad de funciones críticas en el frontend.
