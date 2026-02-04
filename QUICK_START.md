# 🚀 GUÍA RÁPIDA - TimeBill Pro

¡Bienvenido a TimeBill Pro! Sigue estos 3 pasos para poner en marcha tu sistema de facturación en menos de 5 minutos.

---

## 1️⃣ Configura el Backend (Google Sheets)
1. Crea una nueva hoja en [Google Sheets](https://sheets.new).
2. Ve a **Extensiones > Apps Script**.
3. Borra todo el código y pega el contenido de `GOOGLE_APPS_SCRIPT_ACTUALIZADO.js`.
4. Haz clic en **Implementar > Nueva implementación**.
5. Selecciona **Tipo: Aplicación web**, **Ejecutar como: Tu cuenta** y **Acceso: Cualquier persona**.
6. Copia la **URL de la aplicación web** generada.

## 2️⃣ Conecta el Frontend
1. Abre `js/app.js` en tu editor de código.
2. Busca la constante `GOOGLE_SHEETS_CONFIG` al inicio del archivo.
3. Reemplaza el valor de `appScriptUrl` con la URL que copiaste en el paso anterior.
4. (Opcional) En `GOOGLE_APPS_SCRIPT_ACTUALIZADO.js`, reemplaza `SPREADSHEET_ID` con el ID de tu hoja de cálculo.

## 3️⃣ Inicializa la Base de Datos
1. Abre `index.html` en tu navegador.
2. En el modal de inicio de sesión, verás un botón verde: **🚀 Inicializar Base de Datos**. Haz clic en él.
3. El sistema creará automáticamente todas las hojas necesarias y un usuario administrador predeterminado:
   - **Email:** `admin@techfix.com`
   - **Contraseña:** `admin`
4. ¡Inicia sesión y comienza a trackear tu tiempo!

---

## ✅ ¿Qué sigue?
- Ve a la pestaña **Clientes** para añadir tu primer cliente.
- En el **Panel de Control**, selecciona un cliente y comienza una sesión.
- Al terminar, envía la cuenta de cobro directamente por WhatsApp.

---
*Versión 2.1 - Enero 2026*
