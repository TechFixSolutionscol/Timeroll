# TimeBill Pro con Google Apps Script

TimeBill Pro es una aplicación de seguimiento de tiempo y facturación de página única (SPA) diseñada para profesionales y freelancers. Esta versión ha sido refactorizada para utilizar un backend de Google Apps Script, persistiendo los datos en una Hoja de Cálculo de Google y utilizando de forma segura la API de Gemini para la generación de borradores de correo electrónico.

## Características

- **Seguimiento de Tiempo:** Inicia, pausa y detiene un temporizador para registrar el tiempo trabajado.
- **Gestión de Clientes:** Añade, edita y elimina clientes, con datos guardados en una Hoja de Cálculo de Google.
- **Generación de Facturas:** Crea automáticamente una cuenta de cobro basada en el tiempo registrado y una tarifa por hora.
- **Asistente de Correo con IA:** Genera borradores de correo electrónico profesionales para facturas utilizando la API de Gemini de Google.
- **Modo Oscuro:** Cambia entre temas claro y oscuro para mayor comodidad visual.
- **Seguro:** Las claves de API y los IDs de hojas de cálculo se almacenan de forma segura utilizando `PropertiesService` de Apps Script, no en el código del cliente.

## Configuración y Despliegue

Sigue estos pasos para configurar y desplegar tu propia instancia de TimeBill Pro.

### Prerrequisitos

1.  **Cuenta de Google:** Necesitarás una cuenta de Google para usar Google Sheets y Google Apps Script.
2.  **Clave de API de Google Gemini:**
    *   Ve a [Google AI Studio](https://aistudio.google.com/).
    *   Haz clic en **"Get API key"** y sigue las instrucciones para crear una clave de API.
    *   Copia la clave de API. La necesitarás en el Paso 3.

### Paso 1: Crea la Hoja de Cálculo de Google

1.  Ve a [Google Sheets](https://sheets.google.com/) y crea una nueva hoja de cálculo en blanco.
2.  Puedes nombrarla como quieras (p. ej., "TimeBill Pro Data").
3.  En la URL de la hoja de cálculo, copia el **ID de la Hoja de Cálculo**. Es la cadena larga de caracteres entre `/d/` y `/edit`.
    - `https://docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID_DE_LA_HOJA_DE_CALCULO`**`/edit`
4.  Guarda este ID para el Paso 3.

### Paso 2: Crea el Proyecto de Google Apps Script

1.  Ve a [Google Apps Script](https://script.google.com/).
2.  Crea un nuevo proyecto.
3.  Copia el código de los siguientes archivos de este repositorio en los archivos correspondientes en el editor de Apps Script. Es posible que necesites crear algunos de estos archivos.
    - `Code.gs`
    - `index.html`
    - `assets/styles.css` (Crea este archivo como `styles.html` en Apps Script)
    - `assets/scripts.js` (Crea este archivo como `scripts.html` en Apps Script)

    **Importante:** En el editor de Apps Script, los archivos `.css` y `.js` deben crearse como archivos `.html`. Nómbralos `styles` y `scripts` respectivamente (sin la extensión). El código dentro de ellos debe estar envuelto en etiquetas `<style>` y `<script>`, así:

    **styles.html:**
    ```html
    <style>
      /* Pega el contenido de assets/styles.css aquí */
    </style>
    ```

    **scripts.html:**
    ```html
    <script>
      /* Pega el contenido de assets/scripts.js aquí */
    </script>
    ```

### Paso 3: Configura la Aplicación

1.  En el editor de Apps Script, abre el archivo `Code.gs`.
2.  Localiza la función `setup()`.
3.  Pega el **ID de tu Hoja de Cálculo** y tu **Clave de API de Gemini** en las variables correspondientes dentro de esta función.
    ```javascript
    function setup() {
      const spreadsheetId = 'PEGA_TU_ID_DE_HOJA_DE_CALCULO_AQUI';
      const geminiApiKey = 'PEGA_TU_CLAVE_DE_API_DE_GEMINI_AQUI';
      // ...
    }
    ```
4.  En la parte superior del editor, selecciona la función `setup` en el menú desplegable de funciones y haz clic en **Run**.
5.  Es posible que se te pida que autorices los permisos del script. Sigue las indicaciones para permitir que el script acceda a tus Hojas de Cálculo de Google y a servicios externos.

### Paso 4: Despliega la Aplicación Web

1.  En la esquina superior derecha del editor de Apps Script, haz clic en **Deploy** > **New deployment**.
2.  Haz clic en el icono de engranaje (junto a "Select type") y selecciona **Web app**.
3.  En la configuración:
    - **Description:** Dale un nombre a tu despliegue (p. ej., "Versión 1").
    - **Web app > Execute as:** Selecciona **Me**.
    - **Web app > Who has access:** Selecciona **Anyone with Google account** o **Anyone** (si quieres que sea pública). Para uso personal, **Only myself** también es una opción.
4.  Haz clic en **Deploy**.
5.  Copia la **URL de la aplicación web** proporcionada. Esta es la URL de tu aplicación TimeBill Pro en funcionamiento.
