// Names for the sheets
const USERS_SHEET_NAME = 'Usuarios';
const CLIENTS_SHEET_NAME = 'Clientes';

/**
 * Helper function to get the spreadsheet object.
 * Throws an error if the database hasn't been initialized.
 * @returns {Spreadsheet} The spreadsheet object.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Database not initialized. Please run "Setup Database" from the "TimeBill Pro" menu.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}


/**
 * Serves the HTML for the web app. This is the main entry point.
 * @param {Object} e The event parameter.
 * @returns {HtmlOutput} The HTML to serve.
 */
function doGet(e) {
  if (checkAuth()) {
    return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } else {
    return HtmlService.createTemplateFromFile('Login').evaluate()
      .setTitle('Login - TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

/**
 * Creates a custom menu in the Google Sheet UI when the spreadsheet is opened.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('TimeBill Pro')
      .addItem('Setup Database', 'setupDatabase')
      .addItem('Set Gemini API Key', 'setGeminiApiKey')
      .addToUi();
}

/**
 * Sets up the required sheets ('Usuarios', 'Clientes') in the Google Sheet.
 * This function is intended to be run manually from the custom menu.
 */
function setupDatabase() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', ss.getId());

    // Setup Usuarios sheet
    let usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!usersSheet) {
      usersSheet = ss.insertSheet(USERS_SHEET_NAME);
      usersSheet.appendRow(['ID', 'Username', 'PasswordHash', 'Salt']);
      usersSheet.getRange('A1:D1').setFontWeight('bold');

      // Add a default admin user
      const password = Math.random().toString(36).slice(-8); // Generate a random password
      const salt = Utilities.getUuid();
      const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt)
                          .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                          .join('');

      usersSheet.appendRow([1, 'admin', hash, salt]);
      SpreadsheetApp.getUi().alert(`Database setup complete. Default user created:\nUsername: admin\nPassword: ${password}\n\nPlease save this password securely.`);
    } else {
        SpreadsheetApp.getUi().alert('Database sheets already seem to be set up.');
        return;
    }

    // Setup Clientes sheet
    let clientsSheet = ss.getSheetByName(CLIENTS_SHEET_NAME);
    if (!clientsSheet) {
      clientsSheet = ss.insertSheet(CLIENTS_SHEET_NAME);
      clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
      clientsSheet.getRange('A1:E1').setFontWeight('bold');
    }

  } catch (e) {
    Logger.log('Failed to setup database: ' + e.message);
    SpreadsheetApp.getUi().alert('Error during setup: ' + e.message);
  }
}

/**
 * Prompts the user to set their Gemini API key and stores it in Script Properties.
 */
function setGeminiApiKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Set Gemini API Key', 'Please enter your Google Gemini API key:', ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() == ui.Button.OK) {
    const apiKey = response.getResponseText();
    if (apiKey) {
      PropertiesService.getScriptProperties().setProperty('geminiApiKey', apiKey);
      ui.alert('API Key saved successfully.');
    } else {
      ui.alert('API Key cannot be empty.');
    }
  }
}

/**
 * A helper function to include HTML partials into the main template.
 * This allows us to separate our HTML, CSS, and JavaScript.
 * @param {string} filename The name of the file to include.
 * @returns {string} The content of the file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


/*==============================================
 * CLIENT MANAGEMENT FUNCTIONS
 ==============================================*/

/**
 * Gets all clients from the 'Clientes' sheet.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
  try {
    const sheet = getSpreadsheet().getSheetByName(CLIENTS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header row
    return data.map(row => {
      let client = {};
      headers.forEach((header, i) => {
        client[header] = row[i];
      });
      return client;
    });
  } catch (e) {
    Logger.log('Error in getClients: ' + e.message);
    return []; // Return empty array on error
  }
}

/**
 * Adds a new client to the 'Clientes' sheet.
 * @param {Object} clientData An object with client details (Name, Email, Phone, Address).
 * @returns {Object} The client object that was added, including its new ID.
 */
function addClient(clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName(CLIENTS_SHEET_NAME);
    const lastId = sheet.getLastRow() > 1 ? sheet.getRange(sheet.getLastRow(), 1).getValue() : 0;
    const newId = lastId + 1;

    sheet.appendRow([
      newId,
      clientData.Name,
      clientData.Email,
      clientData.Phone,
      clientData.Address
    ]);

    return { ID: newId, ...clientData };
  } catch (e) {
    Logger.log('Error in addClient: ' + e.message);
    throw new Error('Failed to add client. ' + e.message);
  }
}

/**
 * Updates an existing client in the 'Clientes' sheet.
 * @param {Object} clientData An object with client details including the ID.
 * @returns {Object} The updated client object.
 */
function updateClient(clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName(CLIENTS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('ID');

    // Find the row index for the given client ID
    const rowIndex = data.findIndex(row => row[idIndex] == clientData.ID);

    if (rowIndex === -1) {
      throw new Error('Client not found.');
    }

    // Create the updated row array in the correct order
    const updatedRow = headers.map(header => clientData[header] || '');

    // Update the specific row in the sheet (+1 because sheet rows are 1-indexed)
    sheet.getRange(rowIndex + 1, 1, 1, updatedRow.length).setValues([updatedRow]);

    return clientData;
  } catch (e) {
    Logger.log('Error in updateClient: ' + e.message);
    throw new Error('Failed to update client. ' + e.message);
  }
}

/**
 * Deletes a client from the 'Clientes' sheet.
 * @param {number} clientId The ID of the client to delete.
 * @returns {Object} A confirmation object.
 */
function deleteClient(clientId) {
  try {
    const sheet = getSpreadsheet().getSheetByName(CLIENTS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const idIndex = data[0].indexOf('ID');

    // Find the row index for the given client ID
    const rowIndex = data.findIndex(row => row[idIndex] == clientId);

    if (rowIndex === -1) {
      throw new Error('Client not found.');
    }

    // Delete the row (+1 because sheet rows are 1-indexed)
    sheet.deleteRow(rowIndex + 1);

    return { success: true, deletedId: clientId };
  } catch (e) {
    Logger.log('Error in deleteClient: ' + e.message);
    throw new Error('Failed to delete client. ' + e.message);
  }
}


/*==============================================
 * AUTHENTICATION FUNCTIONS
 ==============================================*/

/**
 * Validates a user's password against the stored hash.
 * @param {string} password The password to check.
 * @param {string} salt The salt used for hashing.
 * @param {string} hash The stored password hash.
 * @returns {boolean} True if the password is valid.
 */
function checkPassword(password, salt, hash) {
  const newHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt)
                         .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                         .join('');
  return newHash === hash;
}

/**
 * Attempts to log a user in.
 * @param {string} username The username.
 * @param {string} password The password.
 * @returns {Object} A session object on success, or an error object on failure.
 */
function login(username, password) {
  try {
    const sheet = getSpreadsheet().getSheetByName(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const usernameIndex = headers.indexOf('Username');
    const hashIndex = headers.indexOf('PasswordHash');
    const saltIndex = headers.indexOf('Salt');

    const userRow = data.find(row => row[usernameIndex] === username);

    if (userRow && checkPassword(password, userRow[saltIndex], userRow[hashIndex])) {
      const token = Utilities.getUuid();
      PropertiesService.getUserProperties().setProperty('session_token', token);
      return { success: true, token: token };
    } else {
      return { success: false, message: 'Invalid username or password.' };
    }
  } catch(e) {
      Logger.log('Error in login: ' + e.message);
      return { success: false, message: 'An error occurred during login.' };
  }
}

/**
 * Checks if the user has a valid session token.
 * @returns {boolean} True if the user is authenticated.
 */
function checkAuth() {
  const token = PropertiesService.getUserProperties().getProperty('session_token');
  // In a real app, you'd validate this token more robustly.
  // For this project, simply checking for its existence is sufficient.
  return !!token;
}

/**
 * Logs the user out by deleting their session token.
 */
function logout() {
  PropertiesService.getUserProperties().deleteProperty('session_token');
}

/*==============================================
 * GEMINI API FUNCTION
 ==============================================*/
/**
 * Generates an email draft using the Gemini API.
 * This is a private function intended to be called from the client-side JS.
 * @param {string} clientName The name of the client.
 * @param {string} clientEmail The email of the client.
 * @param {number} hours The number of hours worked.
 * @param {number} total The total amount to be invoiced.
 * @returns {string} The generated email draft.
 */
function generateEmailDraft_(clientName, clientEmail, hours, total) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
  if (!apiKey) {
    return 'Error: Gemini API key not set. Please set it via the "TimeBill Pro" menu in the spreadsheet.';
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  // Sanitize inputs to mitigate prompt injection risks
  const sanitizedClientName = String(clientName).replace(/[^a-zA-Z0-9\s.]/g, '');
  const sanitizedClientEmail = String(clientEmail).replace(/[^a-zA-Z0-9@._-]/g, '');

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${sanitizedClientName} y su correo es ${sanitizedClientEmail}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true // Prevent thrown errors on non-2xx responses
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    if (responseCode === 200 && result.candidates && result.candidates[0].content.parts[0].text) {
      return result.candidates[0].content.parts[0].text;
    } else {
      Logger.log('Gemini API Error Response: ' + response.getContentText());
      return 'Error: No se pudo generar el borrador del correo. ' + (result.error ? result.error.message : 'Respuesta inesperada de la API.');
    }
  } catch (e) {
    Logger.log('Error calling Gemini API: ' + e.toString());
    return 'Error: Ocurrió un error al contactar al servicio de generación de correo.';
  }
}
