
const SPREADSHEET_ID_KEY = 'spreadsheetId';
const SHEET_USERS = 'Usuarios';
const SHEET_CLIENTS = 'Clientes';

// ================================================
// GAS-SPECIFIC SERVER FUNCTIONS
// ================================================

/**
 * Creates a custom menu in the spreadsheet for setup.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('TimeBill Pro')
      .addItem('1. Configurar Base de Datos', 'setupDatabase')
      .addItem('2. Establecer API Key de Gemini', 'setGeminiApiKey')
      .addToUi();
}

/**
 * Sets up the spreadsheet with necessary sheets and a default user.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, ss.getId());

  // Setup Users sheet
  let userSheet = ss.getSheetByName(SHEET_USERS);
  if (!userSheet) {
    userSheet = ss.insertSheet(SHEET_USERS);
    userSheet.appendRow(['Username', 'PasswordHash', 'Salt']);
    const defaultPassword = Math.random().toString(36).slice(-8);
    const salt = Utilities.getUuid();
    userSheet.appendRow(['admin', hashPassword(defaultPassword, salt), salt]);
    SpreadsheetApp.getUi().alert(`Base de Datos Configurada. Usuario por defecto: admin, Contraseña: ${defaultPassword}. Anótala en un lugar seguro.`);
  } else {
     SpreadsheetApp.getUi().alert(`La hoja de "${SHEET_USERS}" ya existe.`);
  }

  // Setup Clients sheet
  let clientSheet = ss.getSheetByName(SHEET_CLIENTS);
  if (!clientSheet) {
    clientSheet = ss.insertSheet(SHEET_CLIENTS);
    clientSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    // Add sample client
    clientSheet.appendRow([1, 'Cliente de Ejemplo', 'cliente@ejemplo.com', '555-1234', 'Calle Falsa 123']);
  } else {
     SpreadsheetApp.getUi().alert(`La hoja de "${SHEET_CLIENTS}" ya existe.`);
  }
}

/**
 * Prompts the user to set their Gemini API key.
 */
function setGeminiApiKey() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
      'API Key de Gemini',
      'Pega tu API Key de Google Gemini aquí:',
      ui.ButtonSet.OK_CANCEL);

  if (result.getSelectedButton() == ui.Button.OK) {
    const apiKey = result.getResponseText();
    PropertiesService.getScriptProperties().setProperty('geminiApiKey', apiKey);
    ui.alert('API Key guardada correctamente.');
  }
}

/**
 * The main entry point for the web app.
 * @param {Object} e The event parameter.
 * @returns {HtmlOutput} The HTML service output.
 */
function doGet(e) {
  if (!checkAuth()) {
    const template = HtmlService.createTemplateFromFile('Login');
    template.logoUrl = getLogoUrl();
    return template.evaluate()
      .setTitle('TimeBill Pro - Login')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }
  const template = HtmlService.createTemplateFromFile('index');
  template.logoUrl = getLogoUrl();
  return template.evaluate()
    .setTitle('TimeBill Pro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}


/**
 * Includes an HTML file content within another.
 * @param {string} filename The name of the file to include.
 * @returns {string} The content of the file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * A utility function to get the spreadsheet object.
 * Throws an error if the spreadsheet is not found or not set up.
 * @returns {Spreadsheet} The spreadsheet object.
 */
function getSpreadsheet() {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
    if (!spreadsheetId) {
        throw new Error("El ID de la hoja de cálculo no está configurado. Por favor, ejecuta la configuración desde el menú de la hoja.");
    }
    try {
        const ss = SpreadsheetApp.openById(spreadsheetId);
        return ss;
    } catch (e) {
        Logger.log(e);
        throw new Error("No se pudo abrir la hoja de cálculo. Verifica que el ID sea correcto y tengas permisos.");
    }
}

/**
 * Returns the URL of the logo from the assets folder.
 */
function getLogoUrl() {
    return "https://i.imgur.com/g8sV27y.jpeg";
}

// ================================================
// DATA FETCHING FOR FRONTEND
// ================================================

/**
 * Gets the initial data needed to bootstrap the application.
 * @returns {Object} An object containing the user's email and the list of clients.
 */
function getInitialData() {
  if (!checkAuth()) {
    throw new Error("No estás autorizado.");
  }
  return {
    userEmail: Session.getActiveUser().getEmail(),
    clients: getClients()
  };
}

// ================================================
// AUTHENTICATION
// ================================================

/**
 * Checks if the user has a valid session token.
 * @returns {boolean} True if authenticated, false otherwise.
 */
function checkAuth() {
  const userProperties = PropertiesService.getUserProperties();
  const sessionToken = userProperties.getProperty('sessionToken');
  return sessionToken != null && sessionToken.length > 0;
}

/**
 * Attempts to log in a user.
 * @param {string} username The user's username.
 * @param {string} password The user's password.
 * @returns {Object} An object with a success boolean and a message.
 */
function loginUser(username, password) {
  try {
    const ss = getSpreadsheet();
    const userSheet = ss.getSheetByName(SHEET_USERS);
    if (!userSheet) {
      return { success: false, message: `La hoja de '${SHEET_USERS}' no se encuentra. Ejecuta la configuración.` };
    }
    const data = userSheet.getDataRange().getValues();
    const headers = data[0];
    const usernameIndex = headers.indexOf('Username');
    const passwordIndex = headers.indexOf('PasswordHash');
    const saltIndex = headers.indexOf('Salt');

    const userRow = data.slice(1).find(row => row[usernameIndex].toLowerCase() === username.toLowerCase());

    if (!userRow) {
      return { success: false, message: 'Usuario o contraseña incorrectos.' };
    }

    const storedHash = userRow[passwordIndex];
    const salt = userRow[saltIndex];
    const inputHash = hashPassword(password, salt);

    if (storedHash === inputHash) {
      const token = Utilities.getUuid();
      PropertiesService.getUserProperties().setProperties({
          'sessionToken': token,
          'user': username
      });
      return { success: true };
    } else {
      return { success: false, message: 'Usuario o contraseña incorrectos.' };
    }
  } catch (e) {
    Logger.log('Login error: ' + e.toString());
    return { success: false, message: 'Error interno del servidor.' };
  }
}

/**
 * Logs out the current user by deleting their session token.
 */
function logout() {
  PropertiesService.getUserProperties().deleteProperty('sessionToken');
  PropertiesService.getUserProperties().deleteProperty('user');
}

/**
 * Hashes a password using SHA-256 and a salt.
 * @param {string} password The password to hash.
 * @param {string} salt The salt to use.
 * @returns {string} The hashed password as a hex string.
 */
function hashPassword(password, salt) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt, Utilities.Charset.UTF_8);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}


// ================================================
// CRUD OPERATIONS - CLIENTS
// ================================================

/**
 * Converts a 2D array from a sheet to an array of objects.
 * @param {Sheet} sheet The sheet to convert.
 * @returns {Array<Object>} An array of objects.
 */
function sheetToObjects_(sheet) {
    const data = sheet.getDataRange().getValues();
    if (data.length < 1) return [];
    const headers = data.shift();
    return data.map(row => {
        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = row[i];
        });
        return obj;
    });
}

/**
 * Gets all clients from the spreadsheet.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
  if (!checkAuth()) throw new Error("No autorizado");
  const clientSheet = getSpreadsheet().getSheetByName(SHEET_CLIENTS);
  return sheetToObjects_(clientSheet);
}

/**
 * Adds a new client to the spreadsheet.
 * @param {Object} clientData The client data from the form.
 * @returns {Array<Object>} The updated list of all clients.
 */
function addClient(clientData) {
  if (!checkAuth()) throw new Error("No autorizado");
  const clientSheet = getSpreadsheet().getSheetByName(SHEET_CLIENTS);
  const lastRow = clientSheet.getLastRow();
  let newId = 1;
  if (lastRow > 1) {
    const allIds = clientSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    newId = allIds.length > 0 ? Math.max(...allIds) + 1 : 1;
  }
  clientSheet.appendRow([newId, clientData.Name, clientData.Email, clientData.Phone, clientData.Address]);
  return getClients();
}


/**
 * Updates an existing client's data.
 * @param {Object} clientData The client data from the form.
 * @returns {Array<Object>} The updated list of all clients.
 */
function updateClient(clientData) {
  if (!checkAuth()) throw new Error("No autorizado");
  const clientSheet = getSpreadsheet().getSheetByName(SHEET_CLIENTS);
  const data = clientSheet.getDataRange().getValues();
  const headers = data.shift();
  const idIndex = headers.indexOf('ID');

  const rowIndex = data.findIndex(row => row[idIndex] == clientData.ID);
  if (rowIndex !== -1) {
    const sheetRowIndex = rowIndex + 2; // +1 for 1-based index, +1 for header
    clientSheet.getRange(sheetRowIndex, 1, 1, headers.length).setValues([[
      clientData.ID,
      clientData.Name,
      clientData.Email,
      clientData.Phone,
      clientData.Address
    ]]);
  } else {
    throw new Error("Cliente no encontrado.");
  }
  return getClients();
}

/**
 * Deletes a client by their ID.
 * @param {string|number} clientId The ID of the client to delete.
 * @returns {Array<Object>} The updated list of all clients.
 */
function deleteClient(clientId) {
  if (!checkAuth()) throw new Error("No autorizado");
  const clientSheet = getSpreadsheet().getSheetByName(SHEET_CLIENTS);
  const data = clientSheet.getDataRange().getValues();
  const idIndex = data[0].indexOf('ID');

  const rowIndex = data.findIndex(row => row[idIndex] == clientId);

  if (rowIndex !== -1) {
    const sheetRowIndex = rowIndex + 1; // data is 0-indexed, sheets are 1-indexed
    clientSheet.deleteRow(sheetRowIndex);
  } else {
    throw new Error("Cliente no encontrado para eliminar.");
  }
  return getClients();
}

// ================================================
// AI & EXTERNAL SERVICES
// ================================================

/**
 * Generates a professional email draft using the Gemini API.
 * @param {Object} client The client object.
 * @param {number} hours The total hours worked.
 * @param {number} total The total amount to be invoiced.
 * @returns {string} The generated email draft text.
 */
function generateEmailDraft(client, hours, total) {
  if (!checkAuth()) throw new Error("No autorizado");

  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
  if (!apiKey) {
    throw new Error("La API Key de Gemini no está configurada. Pídale al administrador que la configure desde el menú de la hoja.");
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  // Sanitize inputs to prevent prompt injection
  const clientName = String(client.Name).replace(/[^a-zA-Z0-9 .,'-]/g, '');
  const clientEmail = String(client.Email).replace(/[^a-zA-Z0-9 .@_-]/g, '');

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${clientName} y su correo es ${clientEmail}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

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
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // Important to catch errors
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    if (responseCode === 200) {
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        return result.candidates[0].content.parts[0].text;
      } else {
        // Log the unexpected response for debugging
        Logger.log("Gemini API response format unexpected: " + JSON.stringify(result));
        throw new Error('No se pudo generar el borrador. La respuesta de la API no fue la esperada.');
      }
    } else {
      // Log the error details
      const errorMessage = (result.error && result.error.message) ? result.error.message : 'Error desconocido de la API.';
      Logger.log("Gemini API Error - Code: " + responseCode + ", Message: " + errorMessage);
      throw new Error('Error en la API de Gemini: ' + errorMessage);
    }
  } catch (error) {
    Logger.log('Error al llamar a la API de Gemini: ' + error.toString());
    throw new Error('No se pudo generar el borrador. Revisa la conexión o la API Key.');
  }
}
