# TimeBill Pro

TimeBill Pro es una aplicación de una sola página (SPA) diseñada para profesionales y freelancers que necesitan una forma sencilla de cronometrar su trabajo, gestionar clientes y generar facturas.

Esta aplicación ha sido refactorizada para utilizar una arquitectura sin servidor, con el frontend construido en **HTML, CSS (Tailwind) y JavaScript puro**, y el backend impulsado por **Google Apps Script**, utilizando **Google Sheets como base de datos**.

## Características

-   **Gestión de Clientes:** Añade, edita y elimina clientes. La información se almacena de forma persistente en una hoja de cálculo de Google.
-   **Cronometraje Preciso:** Inicia, pausa, reanuda y detén un temporizador para registrar el tiempo facturable.
-   **Cálculo de Facturas:** Genera automáticamente el monto a facturar basándose en el tiempo registrado y una tarifa por hora.
-   **Generador de Correos con IA:** Utiliza la API de Google Gemini para redactar un borrador de correo electrónico profesional para enviar la factura al cliente, con un solo clic.
-   **Modo Oscuro:** Ofrece una interfaz cómoda para trabajar en condiciones de poca luz.
-   **Sin Servidor:** Funciona completamente dentro del ecosistema de Google, sin necesidad de gestionar servidores o bases de datos complejas.

## Arquitectura

-   **Frontend:** Una interfaz de usuario estática construida con HTML y JavaScript, estilizada con Tailwind CSS. Se comunica con el backend a través del objeto `google.script.run`.
-   **Backend:** Un script de Google Apps Script (`Code.gs`) que gestiona toda la lógica de negocio:
    -   Sirve la aplicación web.
    -   Realiza operaciones CRUD (Crear, Leer, Actualizar, Eliminar) en la base de datos de Google Sheets.
    -   Maneja de forma segura las llamadas a la API de Google Gemini, protegiendo la clave de la API.
-   **Base de Datos:** Una hoja de cálculo de Google Sheets que almacena los datos de los clientes.

## Configuración y Despliegue

Sigue estos pasos para configurar y desplegar tu propia instancia de TimeBill Pro.

### Paso 1: Crea el Proyecto de Google Apps Script

1.  Ve a [script.google.com/create](https://script.google.com/create).
2.  Copia el contenido de los archivos de este repositorio en el editor de Apps Script:
    -   `Code.gs`: Pega el contenido en el archivo `Code.gs` del editor.
    -   `index.html`: Crea un nuevo archivo HTML (`Archivo > Nuevo > Archivo HTML`) y nómbralo `index`. Pega el contenido de `index.html`.
    -   `templates/styles.html`: Crea un nuevo archivo HTML, nómbralo `templates/styles`. Pega el contenido correspondiente.
    -   `templates/scripts.html`: Crea un nuevo archivo HTML, nómbralo `templates/scripts`. Pega el contenido correspondiente.
3.  Guarda el proyecto (icono de disquete) y dale un nombre, como "TimeBill Pro".

### Paso 2: Configura la Base de Datos

1.  En el editor de Apps Script, selecciona la función `setupDatabase` en el menú desplegable de funciones.
2.  Haz clic en **Ejecutar**.
3.  La primera vez, Google te pedirá autorización para que el script pueda crear y gestionar hojas de cálculo en tu nombre. Acepta los permisos.
4.  Una vez que se complete la ejecución, se creará una nueva hoja de cálculo llamada "TimeBill Pro - Database" en tu Google Drive. El script almacenará automáticamente el ID de esta hoja en las propiedades del script.

### Paso 3: Configura la API de Gemini

1.  Ve a [Google AI Studio](https://aistudio.google.com/app/apikey) para generar una clave de API de Gemini.
2.  En el editor de Apps Script, ve a **Configuración del proyecto** (icono de engranaje a la izquierda).
3.  En la sección **Propiedades del secuencia de comandos**, haz clic en **Añadir propiedad del secuencia de comandos**.
4.  Define la siguiente propiedad:
    -   **Propiedad:** `geminiApiKey`
    -   **Valor:** Pega la clave de API que obtuviste.
5.  Guarda los cambios.

### Paso 4: Despliega la Aplicación

1.  En la esquina superior derecha del editor, haz clic en **Implementar > Nueva implementación**.
2.  Haz clic en el icono de engranaje junto a "Seleccionar tipo" y elige **Aplicación web**.
3.  En la configuración:
    -   **Descripción:** `Versión 1.0`
    -   **Ejecutar como:** `Yo`
    -   **Quién tiene acceso:** `Cualquier persona` (para que sea pública) o `Cualquier usuario con una cuenta de Google` si quieres restringir el acceso.
4.  Haz clic en **Implementar**.
5.  Copia la **URL de la aplicación web**. ¡Esta es la URL de tu aplicación TimeBill Pro en funcionamiento!
