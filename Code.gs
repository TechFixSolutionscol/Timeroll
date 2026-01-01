// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Hoja de Bienvenida y Guía de Configuración
//
// ¡Bienvenido a TimeBill Pro!
//
// Esta aplicación utiliza Google Sheets como base de datos para almacenar la información de tus clientes.
//
// --- GUÍA DE CONFIGURACIÓN RÁPIDA ---
//
// 1.  **Configurar la Base de Datos (Google Sheet):**
//     a. Abre el editor de Apps Script.
//     b. En el menú superior, selecciona "Ejecutar" -> "Ejecutar función" -> "setupDatabase".
//     c. Autoriza los permisos que te solicite el script. Esto creará una nueva hoja de cálculo
//        en tu Google Drive y la configurará con las columnas necesarias.
//
// 2.  **Añadir tu Clave de API de Gemini (Opcional pero Recomendado):**
//     a. Ve a Google AI Studio para obtener tu clave de API: https://aistudio.google.com/app/apikey
//     b. En el editor de Apps Script, ve a "Configuración del proyecto" (el icono del engranaje ⚙️ a la izquierda).
//     c. En la sección "Propiedades del secuencia de comandos", haz clic en "Añadir propiedad del secuencia de comandos".
//     d. Introduce `GEMINI_API_KEY` como el "Nombre de la propiedad" y pega tu clave de API como el "Valor".
//     e. Haz clic en "Guardar propiedades del secuencia de comandos".
//
// 3.  **Desplegar la Aplicación Web:**
//     a. Haz clic en el botón "Desplegar" en la esquina superior derecha del editor.
//     b. Selecciona "Nuevo despliegue".
//     c. Elige "Aplicación web" como el tipo de despliegue.
//     d. En "Configuración", asegúrate de que "Ejecutar como" esté configurado como "Yo" y
//        que "Quién tiene acceso" esté configurado como "Cualquier persona con una cuenta de Google" o
//        "Cualquiera" (según tu preferencia de acceso).
//     e. Haz clic en "Desplegar".
//     f. Copia la URL de la aplicación web proporcionada. ¡Esa es tu aplicación en vivo!
//
// --- FIN DE LA GUÍA ---

const SPREADSHEET_ID_KEY = 'spreadsheetId';
const CLIENTS_SHEET_NAME = 'Clients';

/**
 * Sirve la aplicación web.
 * @param {GoogleAppsScript.Events.DoGet} e El objeto de evento.
 * @returns {GoogleAppsScript.HTML.HtmlOutput} La salida HTML.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('TimeBill Pro')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Incluye el contenido de otro archivo HTML en la plantilla.
 * @param {string} filename El nombre del archivo a incluir.
 * @returns {string} El contenido del archivo.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Prepara la base de datos creando una nueva Hoja de Cálculo de Google.
 */
function setupDatabase() {
  const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
  const spreadsheetId = spreadsheet.getId();

  const sheet = spreadsheet.getSheetByName('Sheet1');
  sheet.setName(CLIENTS_SHEET_NAME);

  const headers = ['ID', 'Name', 'Email', 'Phone', 'Address'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, spreadsheetId);

  Logger.log(`Base de datos creada. ID de la hoja de cálculo: ${spreadsheetId}`);
  SpreadsheetApp.getUi().alert(`Base de datos configurada exitosamente. El ID de la hoja de cálculo es: ${spreadsheetId}`);
}

/**
 * Obtiene la hoja de clientes.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} La hoja de clientes.
 */
function getClientsSheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!spreadsheetId) {
    throw new Error('El ID de la hoja de cálculo no está configurado. Por favor, ejecuta la función setupDatabase.');
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(CLIENTS_SHEET_NAME);
  if (!sheet) {
    throw new Error(`No se encontró la hoja "${CLIENTS_SHEET_NAME}".`);
  }
  return sheet;
}

/**
 * Obtiene todos los clientes de la hoja de cálculo.
 * @returns {Array<Object>} Un array de objetos de clientes.
 */
function getClients() {
  try {
    const sheet = getClientsSheet();
    const range = sheet.getDataRange();
    const values = range.getValues();

    if (values.length <= 1) {
      return [];
    }

    const headers = values[0];
    const clients = values.slice(1).map(row => {
      const client = {};
      headers.forEach((header, index) => {
        // Asegúrate de que el ID se trate como una cadena para mantener la coherencia con el frontend
        client[header.toLowerCase()] = String(row[index]);
      });
      return client;
    });

    return clients;
  } catch (e) {
    Logger.log(e);
    return []; // Devuelve un array vacío en caso de error para que el frontend no falle
  }
}

/**
 * Añade un nuevo cliente a la hoja de cálculo.
 * @param {Object} clientData Los datos del cliente a añadir.
 * @returns {Object} El cliente añadido.
 */
function addClient(clientData) {
  const sheet = getClientsSheet();
  const newId = Utilities.getUuid();
  const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];
  sheet.appendRow(newRow);

  const newClient = {
    id: newId,
    name: clientData.name,
    email: clientData.email,
    phone: clientData.phone,
    address: clientData.address
  };
  return newClient;
}

/**
 * Actualiza un cliente existente en la hoja de cálculo.
 * @param {Object} clientData Los datos actualizados del cliente.
 * @returns {Object} El cliente actualizado.
 */
function updateClient(clientData) {
  const sheet = getClientsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColumnIndex = headers.indexOf('ID');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColumnIndex]) === String(clientData.id)) {
      const row = i + 1;
      const updatedRow = [clientData.id, clientData.name, clientData.email, clientData.phone, clientData.address];
      sheet.getRange(row, 1, 1, updatedRow.length).setValues([updatedRow]);
      return clientData;
    }
  }
  throw new Error(`No se encontró ningún cliente con el ID ${clientData.id}`);
}


/**
 * Elimina un cliente de la hoja de cálculo.
 * @param {string} clientId El ID del cliente a eliminar.
 * @returns {boolean} Verdadero si la eliminación fue exitosa.
 */
function deleteClient(clientId) {
  const sheet = getClientsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColumnIndex = headers.indexOf('ID');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColumnIndex]) === String(clientId)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/**
 * Genera un borrador de correo electrónico usando la API de Gemini.
 * @param {Object} invoiceData Los datos de la factura.
 * @returns {string} El borrador del correo electrónico generado.
 */
function generateEmailDraft(invoiceData) {
    const { client, hours, total } = invoiceData;
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

    if (!apiKey) {
        return 'Error: La clave de API de Gemini no está configurada en las propiedades del script.';
    }

    const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.name} y su correo es ${client.email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

    const payload = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    };

    const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
            'x-goog-api-key': apiKey,
        },
        payload: JSON.stringify(payload)
    };

    try {
        const response = UrlFetchApp.fetch(`${apiUrl}?key=${apiKey}`, options);
        const result = JSON.parse(response.getContentText());

        if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0]) {
            return result.candidates[0].content.parts[0].text;
        } else {
            Logger.log('Respuesta inesperada de la API:', result);
            return 'No se pudo generar el borrador del correo. La respuesta de la API no tuvo el formato esperado.';
        }
    } catch (error) {
        Logger.log('Error al llamar a la API de Gemini:', error);
        return `Error al generar el borrador: ${error.message}`;
    }
}
