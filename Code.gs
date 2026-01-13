/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Función principal que se ejecuta cuando se accede a la URL de la aplicación web
function doGet(e) {
  // Sirve el archivo HTML principal de la aplicación
  return HtmlService.createTemplateFromFile('templates/index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

// Función de utilidad para incluir contenido de otros archivos en la plantilla HTML
function include(filename) {
  // Retorna el contenido del archivo especificado como una cadena de texto
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Configura la base de datos de la aplicación creando una nueva hoja de cálculo de Google.
 * Esta función se debe ejecutar manualmente desde el editor de Apps Script la primera vez.
 * También se puede llamar desde el frontend para inicializar la base de datos.
 */
function setupDatabase() {
  // Crea una nueva hoja de cálculo con el nombre 'TimeBill Pro DB'
  const spreadsheet = SpreadsheetApp.create('TimeBill Pro DB');
  const spreadsheetId = spreadsheet.getId();

  // Renombra la primera hoja a 'Clients' y establece sus encabezados
  const clientsSheet = spreadsheet.getSheets()[0];
  clientsSheet.setName('Clients');
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  clientsSheet.setFrozenRows(1);

  // Crea una nueva hoja para 'Users' y establece sus encabezados
  const usersSheet = spreadsheet.insertSheet('Users');
  usersSheet.appendRow(['ID', 'Email', 'PasswordHash', 'Salt']);
  usersSheet.setFrozenRows(1);

  // Almacena el ID de la hoja de cálculo en las propiedades del script para un acceso fácil
  PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

  // Devuelve un mensaje de éxito con el ID de la hoja de cálculo
  return `Base de datos configurada con éxito. ID: ${spreadsheetId}`;
}

// --- FUNCIONES CRUD PARA CLIENTES ---

/**
 * Obtiene la hoja de cálculo de clientes.
 * @returns {Sheet} El objeto de la hoja de clientes.
 */
function getClientSheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('El ID de la hoja de cálculo no está configurado. Ejecuta setupDatabase() primero.');
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  return spreadsheet.getSheetByName('Clients');
}

/**
 * Obtiene todos los clientes de la hoja de cálculo.
 * @returns {Array<Object>} Un arreglo de objetos de clientes.
 */
function getClients() {
  const sheet = getClientSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Saca la fila de encabezados

  // Convierte las filas de datos en objetos
  return data.map(row => {
    const client = {};
    headers.forEach((header, index) => {
      client[header] = row[index];
    });
    return client;
  });
}

/**
 * Añade un nuevo cliente a la hoja de cálculo.
 * @param {Object} clientData - Los datos del cliente a añadir.
 * @returns {Object} El cliente recién añadido.
 */
function addClient(clientData) {
  const sheet = getClientSheet();
  const newId = Utilities.getUuid(); // Genera un ID único
  const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];
  sheet.appendRow(newRow);

  return { id: newId, ...clientData };
}

/**
 * Actualiza un cliente existente en la hoja de cálculo.
 * @param {Object} clientData - Los datos actualizados del cliente.
 * @returns {Object} El cliente actualizado.
 */
function updateClient(clientData) {
  const sheet = getClientSheet();
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] === clientData.id);

  if (rowIndex > 0) { // rowIndex > 0 para evitar el encabezado
    const newRow = [clientData.id, clientData.name, clientData.email, clientData.phone, clientData.address];
    // El rango es fila, columna, número de filas, número de columnas
    sheet.getRange(rowIndex + 1, 1, 1, newRow.length).setValues([newRow]);
    return clientData;
  }

  throw new Error('Cliente no encontrado para actualizar.');
}

/**
 * Elimina un cliente de la hoja de cálculo.
 * @param {string} clientId - El ID del cliente a eliminar.
 * @returns {string} El ID del cliente eliminado.
 */
function deleteClient(clientId) {
  const sheet = getClientSheet();
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] === clientId);

  if (rowIndex > 0) { // rowIndex > 0 para evitar el encabezado
    sheet.deleteRow(rowIndex + 1);
    return clientId;
  }

  throw new Error('Cliente no encontrado para eliminar.');
}

// --- LÓGICA DE LA API DE GEMINI ---

/**
 * Genera un borrador de correo electrónico utilizando la API de Gemini.
 * @param {Object} invoiceData - Los datos de la factura (cliente, horas, total).
 * @returns {string} El borrador del correo electrónico generado.
 */
function generateEmailDraft(invoiceData) {
  const { client, hours, total } = invoiceData;
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');

  if (!apiKey) {
    return 'Error: La clave de la API de Gemini no está configurada en las propiedades del script.';
  }

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
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
    payload: JSON.stringify(payload)
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates[0].content.parts[0].text) {
      return result.candidates[0].content.parts[0].text;
    } else {
      return 'No se pudo generar el borrador. La respuesta de la API no fue la esperada.';
    }
  } catch (error) {
    Logger.log(error);
    return 'Error al conectar con la API de Gemini. Por favor, verifica la configuración y la clave.';
  }
}

// --- FUNCIONES DE AUTENTICACIÓN DE USUARIOS ---

/**
 * Obtiene la hoja de cálculo de usuarios.
 * @returns {Sheet} El objeto de la hoja de usuarios.
 */
function getUserSheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('El ID de la hoja de cálculo no está configurado. Ejecuta setupDatabase() primero.');
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  return spreadsheet.getSheetByName('Users');
}

/**
 * Registra un nuevo usuario.
 * @param {string} email - El email del usuario.
 * @param {string} password - La contraseña del usuario.
 * @returns {Object} Un mensaje de éxito o un objeto de error.
 */
function registerUser(email, password) {
  const sheet = getUserSheet();
  const data = sheet.getDataRange().getValues();
  const userExists = data.some(row => row[1] === email);

  if (userExists) {
    return { error: 'El usuario ya existe.' };
  }

  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  const newId = Utilities.getUuid();

  sheet.appendRow([newId, email, hash, salt]);

  return { success: 'Usuario registrado con éxito.' };
}

/**
 * Inicia sesión de un usuario.
 * @param {string} email - El email del usuario.
 * @param {string} password - La contraseña del usuario.
 * @returns {Object} Un objeto de sesión o un objeto de error.
 */
function loginUser(email, password) {
  const sheet = getUserSheet();
  const data = sheet.getDataRange().getValues();
  // Busca desde la segunda fila para ignorar el encabezado
  const userRow = data.slice(1).find(row => row[1] === email);

  if (!userRow) {
    return { error: 'Usuario o contraseña incorrectos.' };
  }

  const [, , storedHash, storedSalt] = userRow;

  if (verifyPassword(password, storedSalt, storedHash)) {
    // En una aplicación real, aquí se crearía una sesión
    return { success: true, email: email };
  } else {
    return { error: 'Usuario o contraseña incorrectos.' };
  }
}