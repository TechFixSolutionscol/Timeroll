# TimeBill Pro

TimeBill Pro es una aplicación de facturación y seguimiento del tiempo de código abierto diseñada para profesionales y pequeñas empresas. Construida con HTML, Tailwind CSS y JavaScript, utiliza Google Sheets como base de datos y Google Apps Script para la lógica de backend.

## Características

- **Seguimiento del Tiempo:** Inicia, pausa, reanuda y detén temporizadores para un seguimiento preciso del tiempo.
- **Gestión de Clientes:** Añade, edita y elimina clientes directamente desde la aplicación.
- **Facturación Automática:** Genera facturas basadas en las horas registradas y las tarifas por hora.
- **Backend sin Servidor:** Utiliza Google Sheets y Google Apps Script para una solución de backend rentable y fácil de mantener.
- **Autenticación Segura:** El sistema de inicio de sesión utiliza hashing de contraseñas con salt para mayor seguridad.
- **Modo Oscuro:** Cambia entre temas claro y oscuro para una mayor comodidad visual.

## Configuración y Despliegue

Sigue estos pasos para configurar y desplegar tu propia instancia de TimeBill Pro.

### Paso 1: Configurar la Hoja de Cálculo de Google

1.  **Crea una nueva Hoja de Cálculo de Google:** Ve a [Google Sheets](https://sheets.new) y crea una nueva hoja de cálculo en blanco.
2.  **Obtén la URL:** Copia la URL de tu hoja de cálculo. La necesitarás más adelante.
3.  **Configura los Permisos de Uso Compartido:**
    *   Haz clic en el botón "Compartir" en la esquina superior derecha.
    *   En "Acceso general", cambia la configuración a **"Cualquier persona con el enlace"**.
    *   Asegúrate de que el rol esté configurado como **"Editor"**.
    *   Haz clic en "Hecho".

### Paso 2: Desplegar el Script de Google Apps

1.  **Abre el Editor de Scripts:**
    *   En tu Hoja de Cálculo de Google, ve a `Extensiones > Apps Script`.
    *   Se abrirá un nuevo proyecto de script. Borra cualquier código existente en el archivo `Code.gs`.
2.  **Añade el Código del Backend:**
    *   Copia todo el contenido del archivo `Code.gs` de este repositorio.
    *   Pega el código en el editor de Apps Script.
3.  **Configura la URL de la Hoja de Cálculo en el Script:**
    *   Dentro del script (`Code.gs`), encuentra la línea: `const SPREADSHEET_URL = "TU_SPREADSHEET_URL_AQUI";`
    *   Reemplaza `"TU_SPREADSHEET_URL_AQUI"` con la URL de tu Hoja de Cálculo de Google que copiaste en el Paso 1.
4.  **Despliega el Script como una Aplicación Web:**
    *   Haz clic en el botón **"Implementar"** en la esquina superior derecha y selecciona **"Nueva implementación"**.
    *   Haz clic en el icono de engranaje (⚙️) junto a "Seleccionar tipo" y elige **"Aplicación web"**.
    *   En el cuadro de diálogo, introduce la siguiente configuración:
        *   **Descripción:** `TimeBill Pro Backend` (o la que prefieras).
        *   **Ejecutar como:** `Yo`.
        *   **Quién tiene acceso:** `Cualquier persona`.
    *   Haz clic en **"Implementar"**.
5.  **Autoriza los Permisos:**
    *   Google te pedirá que autorices los permisos del script. Sigue las indicaciones.
    *   Puede que veas una advertencia de "Google no ha verificado esta aplicación". Haz clic en **"Avanzado"** y luego en **"Ir a [nombre de tu proyecto] (no seguro)"** para continuar.
    *   Permite que el script acceda a tu cuenta de Google.
6.  **Copia la URL de la Aplicación Web:**
    *   Después de la implementación, se te proporcionará una **URL de la aplicación web**. Cópiala. Esta es la URL de tu backend.

### Paso 3: Configurar la Aplicación Frontend

1.  **Clona o Descarga el Repositorio:**
    *   Obtén los archivos `index.html`, `styles.css` y `scripts.js` de este repositorio.
2.  **Abre `index.html` en tu Navegador:**
    *   Simplemente abre el archivo `index.html` en un navegador web como Chrome, Firefox o Edge.
3.  **Configuración Inicial en la Aplicación:**
    *   La primera vez que abras la aplicación, verás una pantalla de configuración.
    *   **Pega la URL del Script de Google Apps:** Pega la URL de la aplicación web que copiaste en el Paso 2 en el campo correspondiente.
    *   **Pega la URL de la Hoja de Cálculo de Google:** Pega la URL de tu hoja de cálculo del Paso 1 en su campo.
    *   Haz clic en **"Guardar Configuración"**.
4.  **Crea las Tablas de la Base de Datos:**
    *   Después de guardar la configuración, el botón **"Crear Tablas"** se activará.
    *   Haz clic en él. Esto ejecutará la función `setup` en tu backend, que creará automáticamente las hojas "Usuarios", "Clientes" y "Facturas" en tu hoja de cálculo.
5.  **Inicia Sesión y Comienza a Usar la Aplicación:**
    *   Una vez que las tablas se hayan creado, serás redirigido a la pantalla de inicio de sesión.
    *   El usuario administrador por defecto es:
        *   **Usuario:** `admin`
        *   **Contraseña:** `admin123`
    *   ¡Ahora estás listo para usar TimeBill Pro!

## Contribuciones

Las contribuciones son bienvenidas. Si tienes sugerencias para mejorar la aplicación, por favor, abre un issue o envía un pull request.
