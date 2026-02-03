# Análisis del Proyecto: TimeBill Pro

## 1. Descripción General de la Aplicación
TimeBill Pro es una aplicación de página única (SPA) diseñada para el seguimiento del tiempo y la facturación de clientes. Permite a los usuarios gestionar clientes, registrar sesiones de trabajo mediante un temporizador y generar resúmenes de cobro que pueden compartirse vía WhatsApp.

### Funcionalidades Principales:
- **Panel de Control:** Incluye un temporizador en tiempo real con selección de cliente e ingreso de valor por hora.
- **Gestión de Clientes:** Funcionalidad completa CRUD (Crear, Leer, Actualizar, Eliminar) para datos de clientes.
- **Gestión de Usuarios:** Interfaz exclusiva para administradores para gestionar miembros del equipo y sus roles (Admin vs. Usuario).
- **Configuración:** Proporciona una utilidad para inicializar la base de datos en Google Sheets con las hojas y encabezados requeridos.
- **Modo Oscuro:** Soporte para cambio de tema (Claro/Oscuro).
- **Integración de Facturación:** Genera una "Cuenta de Cobro" (resumen de factura) y facilita su envío por WhatsApp.

---

## 2. Stack Técnico
- **Frontend:** HTML5, CSS3 (Tailwind CSS vía CDN), JavaScript Vanilla.
- **Backend:** Google Apps Script (GAS).
- **Base de Datos:** Google Sheets.
- **Autenticación:** Implementación personalizada utilizando hash de contraseñas SHA-256 y control de acceso basado en roles.

---

## 3. Estado Actual de la Implementación

### Salud del Código:
- ✅ **Limpieza realizada:** Se eliminó un duplicado redundante del `user-modal` en `index.html`.
- ✅ **Unicidad de IDs:** Se verificó que todos los elementos HTML tengan ahora IDs únicos.
- ⚠️ **Redundancias encontradas:**
    - `js/app.js`: La función `loginUser()` está sombreada (shadowed) por `loginUserViaSheets()`.
    - `js/app.js`: `registerUserViaSheets()` está definida pero no se utiliza.
    - GAS: `getUserConfig` y `getSessions` son actualmente marcadores de posición (placeholders).

### Configuración:
- **ID de Hoja de Cálculo:** El backend utiliza un marcador de posición `"tu_id_de_spreadsheet_aqui"`.
- **URL de Apps Script:** Está codificada (hardcoded) en `js/app.js` e `INSTRUCCIONES_FASE5.md`.

---

## 4. Brechas en Documentación y Funcionalidades

### Archivos de Documentación Faltantes:
Los siguientes archivos se mencionan en `README.md` pero no están presentes en el repositorio:
- `QUICK_START.md`
- `STATUS_FINAL.md`
- `RESUMEN_IMPLEMENTACION.md`

### Discrepancias con la Memoria del Proyecto:
Existen varias funcionalidades mencionadas en los antecedentes/memoria del proyecto que no están presentes en el código actual:
- **Integración con Gemini AI:** No existe código para la generación de borradores de correo mediante IA.
- **Hash de Contraseña con Sal (Salt):** La implementación actual utiliza SHA-256 plano sin sales únicas por usuario.
- **ID de Despliegue de GAS:** El código del backend no recupera dinámicamente el ID de la hoja de cálculo; depende de un marcador manual.

---

## 5. Recomendaciones
1. **Sincronizar ID de Base de Datos:** Actualizar `SPREADSHEET_ID` en `GOOGLE_APPS_SCRIPT_ACTUALIZADO.js` con el ID real de la documentación.
2. **Refactorizar JS:** Eliminar funciones no utilizadas o sombreadas (`loginUser`, `registerUserViaSheets`) para mejorar el mantenimiento.
3. **Mejorar la Seguridad:** Implementar el hashing con sal según lo mencionado en la memoria del proyecto.
4. **Implementar Funciones de IA:** Integrar la API de Gemini para la generación de correos si es un requisito actual.
5. **Restaurar Documentación:** Recrear o localizar los archivos `.md` faltantes para asistir a los usuarios.
