// Archivo principal para el código del backend de Google Apps Script.
function doGet() {
  const template = HtmlService.createTemplateFromFile('templates/index');
  template.clients = getClients(); // Precarga los clientes
  return template.evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setTitle('TimeBill Pro');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// =================================================================
// CONFIGURACIÓN DE LA BASE DE DATOS (GOOGLE SHEETS)
// =================================================================

/**
 * Crea una nueva hoja de cálculo de Google con las hojas "Clientes" y "Usuarios"
 * y guarda su ID en las propiedades del script para uso futuro.
 * Esta función está pensada para ser ejecutada manualmente una vez desde el editor de Apps Script.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.create('TimeBill Pro DB');
  ss.insertSheet('Clients').getRange('A1:E1').setValues([['ID', 'Name', 'Email', 'Phone', 'Address']]);
  ss.insertSheet('Users').getRange('A1:C1').setValues([['ID', 'Username', 'PasswordHash']]);
  ss.deleteSheet(ss.getSheetByName('Sheet1')); // Eliminar la hoja por defecto

  const spreadsheetId = ss.getId();
  PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

  // Añadir un cliente de ejemplo
  const clientSheet = ss.getSheetByName('Clients');
  const uniqueId = Utilities.getUuid();
  clientSheet.appendRow([uniqueId, 'Cliente de Ejemplo S.A.S', 'ejemplo@correo.com', '3001234567', 'Calle Falsa 123']);

  Logger.log(`Base de datos configurada. ID de la hoja de cálculo: ${spreadsheetId}`);
  return spreadsheetId;
}

/**
 * Obtiene la instancia de la hoja de cálculo activa utilizando el ID almacenado.
 * @returns {Spreadsheet} La hoja de cálculo de la base de datos.
 */
function _getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('El ID de la hoja de cálculo no está configurado. Por favor, ejecuta la función setupDatabase() primero.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * Obtiene la hoja específica de "Clientes".
 * @returns {Sheet} La hoja de clientes.
 */
function _getClientSheet() {
  return _getSpreadsheet().getSheetByName('Clients');
}

// =================================================================
// OPERACIONES CRUD PARA CLIENTES
// =================================================================

/**
 * Obtiene todos los clientes de la hoja de cálculo.
 * @returns {Array<Object>} Un array de objetos de clientes.
 */
function getClients() {
  const sheet = _getClientSheet();
  if (sheet.getLastRow() <= 1) return []; // No hay clientes si solo está la cabecera
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  return data.map(row => {
    let client = {};
    headers.forEach((header, index) => {
      client[header] = row[index];
    });
    return client;
  });
}

/**
 * Añade un nuevo cliente a la hoja de cálculo.
 * @param {Object} clientData - El objeto con los datos del cliente.
 * @returns {Object} El cliente añadido con su nuevo ID.
 */
function addClient(clientData) {
  const sheet = _getClientSheet();
  const uniqueId = Utilities.getUuid();
  const newRow = [
    uniqueId,
    clientData.name,
    clientData.email,
    clientData.phone,
    clientData.address
  ];
  sheet.appendRow(newRow);
  return { ...clientData, ID: uniqueId }; // Devolver el cliente con el ID asignado
}

/**
 * Actualiza un cliente existente en la hoja de cálculo.
 * @param {Object} clientData - El objeto con los datos actualizados del cliente, incluyendo el ID.
 */
function updateClient(clientData) {
  const sheet = _getClientSheet();
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues(); // Obtener solo la columna de IDs
  const rowIndex = data.findIndex(row => row[0] === clientData.ID);

  if (rowIndex !== -1) {
    const rowToUpdate = rowIndex + 2; // +2 porque el índice es base 0 y la data empieza en la fila 2
    sheet.getRange(rowToUpdate, 2, 1, 4).setValues([[
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ]]);
    return { success: true, message: 'Cliente actualizado.' };
  }
  return { success: false, message: 'Cliente no encontrado.' };
}

// =================================================================
// INTEGRACIONES DE API (GEMINI)
// =================================================================

/**
 * Llama a la API de Gemini de forma segura desde el backend para generar un borrador de correo.
 * @param {Object} invoiceData - Datos de la factura { client, hours, total }.
 * @returns {string} El borrador del correo electrónico generado.
 */
function generateEmailDraftSecurely(invoiceData) {
  const { client, hours, total } = invoiceData;
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');

  if (!apiKey) {
    return 'Error: La clave de la API de Gemini no está configurada en las propiedades del script.';
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true // importante para poder manejar errores
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    if (responseCode === 200 && result.candidates && result.candidates[0].content.parts[0].text) {
      return result.candidates[0].content.parts[0].text;
    } else {
      Logger.log(`Error en la API de Gemini: ${JSON.stringify(result)}`);
      return `No se pudo generar el borrador. Código de error: ${responseCode}`;
    }
  } catch (e) {
    Logger.log(`Excepción al llamar a la API de Gemini: ${e.toString()}`);
    return 'Error al conectar con el servicio de generación de correo.';
  }
}

/**
 * Elimina un cliente de la hoja de cálculo.
 * @param {string} clientId - El ID del cliente a eliminar.
 */
function deleteClient(clientId) {
  const sheet = _getClientSheet();
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const rowIndex = data.findIndex(row => row[0] === clientId);

  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex + 2);
    return { success: true, message: 'Cliente eliminado.' };
  }
  return { success: false, message: 'Cliente no encontrado.' };
}
