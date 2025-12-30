# TimeBill Pro

TimeBill Pro es una aplicación de seguimiento de tiempo y gestión de clientes creada con HTML, Tailwind CSS y Google Apps Script.

## Características

-   **Seguimiento de tiempo:** Inicia, pausa, reanuda y detiene un temporizador para registrar el tiempo dedicado a las tareas.
-   **Gestión de clientes:** Añade, edita y elimina clientes.
-   **Facturación:** Genera una factura basada en el tiempo registrado y la tarifa por hora.
-   **Modo oscuro:** Cambia entre los temas claro y oscuro para una mayor comodidad visual.

## Configuración

### 1. Crear una hoja de cálculo de Google

1.  Crea una nueva hoja de cálculo de Google en [Google Sheets](https://sheets.new).
2.  Copia el ID de la hoja de cálculo de la URL. El ID es la cadena larga de caracteres entre `/d/` y `/edit`.
    -   Ejemplo: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
3.  Pega este ID en un lugar seguro. Lo necesitarás en los siguientes pasos.

### 2. Configurar el proyecto de Google Apps Script

1.  Abre el [editor de Google Apps Script](https://script.google.com).
2.  Crea un nuevo proyecto.
3.  Copia el contenido de `Code.gs`, `index.html`, `scripts.html` y `styles.html` en los archivos correspondientes del editor de Apps Script.
    -   Puedes crear nuevos archivos HTML en el editor seleccionando `Archivo > Nuevo > Archivo HTML`.
4.  Guarda los cambios.

### 3. Configurar las propiedades del script

1.  En el editor de Apps Script, selecciona `Archivo > Propiedades del proyecto > Propiedades del script`.
2.  Añade las siguientes propiedades:
    -   **Propiedad:** `sheetId`
    -   **Valor:** El ID de la hoja de cálculo de Google que copiaste anteriormente.
    -   **Propiedad:** `geminiApiKey`
    -   **Valor:** Tu clave de API de Google Gemini. Puedes obtener una en [Google AI Studio](https://aistudio.google.com/app/apikey).
3.  Guarda las propiedades del script.

### 4. Ejecutar la configuración inicial

1.  En el editor de Apps Script, selecciona la función `setupSheet` en el menú desplegable de funciones.
2.  Haz clic en `Ejecutar`.
3.  Autoriza los permisos necesarios. Esto creará automáticamente la hoja "Clients" con las cabeceras necesarias en tu hoja de cálculo de Google.

### 5. Desplegar la aplicación web

1.  En el editor de Apps Script, haz clic en `Desplegar > Nuevo despliegue`.
2.  Selecciona el tipo de despliegue `Aplicación web`.
3.  En la configuración, asegúrate de que `Ejecutar como` esté configurado como `Yo` y que `Quién tiene acceso` esté configurado como `Cualquier persona`.
4.  Haz clic en `Desplegar`.
5.  Autoriza los permisos necesarios.
6.  Copia la URL de la aplicación web. Esta es la URL de tu aplicación TimeBill Pro.
