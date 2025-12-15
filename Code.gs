// ===================================================================================================
// CÓDIGO DEL BACKEND - TIMEBILL PRO (Google Apps Script)
// ===================================================================================================
// INSTRUCCIONES:
// 1. Abre Google Apps Script: https://script.google.com/
// 2. Crea un nuevo proyecto. Borra cualquier código de ejemplo.
// 3. Pega TODO este código en el editor y guarda el proyecto.
// 4. Configura las variables de entorno (ver función setup).
// 5. Despliega el script:
//    - Haz clic en "Desplegar" > "Nuevo despliegue".
//    - Selecciona "Aplicación web" como tipo de despliegue.
//    - En la configuración:
//        - Descripción: "TimeBill Pro API"
//        - Ejecutar como: "Yo"
//        - Quién tiene acceso: "Cualquier persona" (Esto es para que tu frontend pueda llamarlo)
//    - Haz clic en "Desplegar".
//    - **IMPORTANTE**: Copia la URL de la aplicación web. La necesitarás para el frontend.
// ===================================================================================================

// ===================================================================================================
// CONFIGURACIÓN INICIAL Y VARIABLES GLOBALES
// ===================================================================================================
const SPREADSHEET_URL_PROPERTY = 'SPREADSHEET_URL';
const GEMINI_API_KEY_PROPERTY = 'GEMINI_API_KEY';

// Función principal que maneja las solicitudes POST del frontend.
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);

    if (!requestData.action) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: 'No action specified.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    let response;
    switch (requestData.action) {
      case 'setup':
        response = setup();
        break;
      case 'getClients':
        response = getClients();
        break;
      case 'addClient':
        response = addClient(requestData.payload);
        break;
      case 'updateClient':
        response = updateClient(requestData.payload);
        break;
      case 'deleteClient':
        response = deleteClient(requestData.payload);
        break;
      case 'saveInvoice':
        response = saveInvoice(requestData.payload);
        break;
      case 'generateEmailDraft':
        response = generateEmailDraft(requestData.payload);
        break;
      default:
        response = { status: 'error', message: 'Invalid action.' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error en doPost: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: 'An internal error occurred.', details: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ===================================================================================================
// FUNCIÓN DE CONFIGURACIÓN DEL ENTORNO
// ===================================================================================================
// Esta función configura las tablas en la hoja de cálculo de Google.
// IMPORTANTE: Debes configurar manualmente la URL de tu hoja de cálculo y tu API key de Gemini.
// Para ello, ve a "Configuración del proyecto" (el icono del engranaje) y busca la sección "Propiedades del secuencia de comandos".
// Añade dos propiedades:
// 1. SPREADSHEET_URL: La URL completa de tu Google Sheet.
// 2. GEMINI_API_KEY: Tu clave de API para el servicio de Google Gemini.
function setup() {
  try {
    const SPREADSHEET_URL = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_URL_PROPERTY);
    if (!SPREADSHEET_URL) {
      return { status: 'error', message: 'La URL de la hoja de cálculo no está configurada. Por favor, configúrala en las propiedades del script.' };
    }
    const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);

    // Configurar la hoja de Clientes
    let clientsSheet = ss.getSheetByName('Clients');
    if (!clientsSheet) {
      clientsSheet = ss.insertSheet('Clients');
      const clientHeaders = [['ID', 'Name', 'Email', 'Phone', 'Address']];
      clientsSheet.getRange(1, 1, 1, 5).setValues(clientHeaders).setFontWeight('bold');
      clientsSheet.setFrozenRows(1);
    }

    // Configurar la hoja de Facturas
    let invoicesSheet = ss.getSheetByName('Invoices');
    if (!invoicesSheet) {
      invoicesSheet = ss.insertSheet('Invoices');
      const invoiceHeaders = [['Invoice ID', 'Client ID', 'Client Name', 'Date', 'Duration (Hours)', 'Hourly Rate', 'Total']];
      invoicesSheet.getRange(1, 1, 1, 7).setValues(invoiceHeaders).setFontWeight('bold');
      invoicesSheet.setFrozenRows(1);
    }

    return { status: 'success', message: 'Hojas de cálculo configuradas correctamente.' };
  } catch (error) {
    Logger.log('Error en setup: ' + error.toString());
    return { status: 'error', message: 'Error al configurar las hojas.', details: error.toString() };
  }
}

// ===================================================================================================
// FUNCIONES CRUD PARA CLIENTES
// ===================================================================================================

// Obtiene todos los clientes de la hoja de cálculo.
function getClients() {
  try {
    const SPREADSHEET_URL = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_URL_PROPERTY);
    const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    const sheet = ss.getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();

    const clients = data.slice(1).map(row => ({
      id: row[0],
      name: row[1],
      email: row[2],
      phone: row[3],
      address: row[4]
    }));

    return { status: 'success', payload: clients };
  } catch (error) {
    Logger.log('Error en getClients: ' + error.toString());
    return { status: 'error', message: 'No se pudieron obtener los clientes.', details: error.toString() };
  }
}

// Añade un nuevo cliente.
function addClient(clientData) {
  try {
    const SPREADSHEET_URL = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_URL_PROPERTY);
    const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    const sheet = ss.getSheetByName('Clients');

    // Generar un ID único
    const lastRow = sheet.getLastRow();
    const newId = lastRow > 0 ? sheet.getRange(lastRow, 1).getValue() + 1 : 1;

    sheet.appendRow([
      newId,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ]);

    const newClient = { ...clientData, id: newId };
    return { status: 'success', message: 'Cliente añadido.', payload: newClient };
  } catch (error) {
    Logger.log('Error en addClient: ' + error.toString());
    return { status: 'error', message: 'No se pudo añadir el cliente.', details: error.toString() };
  }
}

// Actualiza un cliente existente.
function updateClient(clientData) {
  try {
    const SPREADSHEET_URL = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_URL_PROPERTY);
    const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    const sheet = ss.getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();

    const rowIndex = data.findIndex(row => row[0] == clientData.id);

    if (rowIndex === -1) {
      return { status: 'error', message: 'Cliente no encontrado.' };
    }

    sheet.getRange(rowIndex + 1, 2, 1, 4).setValues([[
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ]]);

    return { status: 'success', message: 'Cliente actualizado.', payload: clientData };
  } catch (error) {
    Logger.log('Error en updateClient: ' + error.toString());
    return { status: 'error', message: 'No se pudo actualizar el cliente.', details: error.toString() };
  }
}

// Elimina un cliente.
function deleteClient(payload) {
  try {
    const { id } = payload;
    const SPREADSHEET_URL = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_URL_PROPERTY);
    const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    const sheet = ss.getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();

    const rowIndex = data.findIndex(row => row[0] == id);

    if (rowIndex === -1) {
      return { status: 'error', message: 'Cliente no encontrado.' };
    }

    sheet.deleteRow(rowIndex + 1);

    return { status: 'success', message: 'Cliente eliminado.', payload: { id } };
  } catch (error) {
    Logger.log('Error en deleteClient: ' + error.toString());
    return { status: 'error', message: 'No se pudo eliminar el cliente.', details: error.toString() };
  }
}

// ===================================================================================================
// FUNCIONES PARA FACTURAS
// ===================================================================================================

// Guarda una nueva factura.
function saveInvoice(invoiceData) {
  try {
    const SPREADSHEET_URL = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_URL_PROPERTY);
    const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    const sheet = ss.getSheetByName('Invoices');

    const newId = sheet.getLastRow(); // Simple ID for now
    const date = new Date();

    sheet.appendRow([
      newId,
      invoiceData.client.id,
      invoiceData.client.name,
      date,
      invoiceData.hours,
      invoiceData.rate,
      invoiceData.total
    ]);

    return { status: 'success', message: 'Factura guardada.' };
  } catch (error) {
    Logger.log('Error en saveInvoice: ' + error.toString());
    return { status: 'error', message: 'No se pudo guardar la factura.', details: error.toString() };
  }
}

// ===================================================================================================
// INTEGRACIÓN CON API DE GEMINI
// ===================================================================================================

// Genera un borrador de correo electrónico usando la API de Gemini.
function generateEmailDraft(payload) {
  const { client, hours, total } = payload;
  const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty(GEMINI_API_KEY_PROPERTY);

  if (!GEMINI_API_KEY) {
    return { status: 'error', message: 'La API Key de Gemini no está configurada.' };
  }

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.name} y su correo es ${client.email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify({
        "contents": [{
          "parts": [{ "text": prompt }]
        }]
      })
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates.length > 0) {
      const text = result.candidates[0].content.parts[0].text;
      return { status: 'success', payload: { draft: text } };
    } else {
      Logger.log('Respuesta inesperada de la API de Gemini: ' + JSON.stringify(result));
      return { status: 'error', message: 'No se pudo generar el borrador. La respuesta de la API no fue la esperada.' };
    }

  } catch (error) {
    Logger.log('Error al llamar a la API de Gemini: ' + error.toString());
    return { status: 'error', message: 'Error al comunicarse con la API de Gemini.', details: error.toString() };
  }
}
