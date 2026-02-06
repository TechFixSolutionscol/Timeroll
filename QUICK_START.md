# 📋 GUÍA RÁPIDA - TimeBill Pro

Sigue estos 3 pasos para poner en marcha tu sistema de seguimiento y cobro.

### Paso 1: Configurar Google Sheets y Apps Script
1. Crea un nuevo Google Sheet.
2. Ve a **Extensiones → Apps Script**.
3. Copia el contenido de `GOOGLE_APPS_SCRIPT_ACTUALIZADO.js` y pégalo allí.
4. Haz clic en **Implementar → Nueva implementación**.
5. Selecciona tipo **Servicio web**, ejecutar como **Tu email**, acceso **Cualquiera**.
6. Copia la **URL de la implementación**.

### Paso 2: Vincular Frontend
1. Abre `js/app.js`.
2. Busca la constante `GOOGLE_SHEETS_CONFIG` y pega la URL que copiaste en `appScriptUrl`.
3. Abre `index.html` en tu navegador.

### Paso 3: Inicializar la Base de Datos
1. En la aplicación, inicia sesión (demo).
2. Dirígete a la pestaña **Configuración ⚙️**.
3. Haz clic en el botón **Inicializar Base de Datos**.
4. ¡Listo! Ya puedes empezar a crear clientes y registrar sesiones.
