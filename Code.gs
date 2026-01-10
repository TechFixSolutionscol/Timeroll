// This file will contain the Google Apps Script backend logic.

const SCRIPT_PROPERTY_SPREADSHEET_ID = 'spreadsheetId';

/**
 * Serves the main HTML page of the web app.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('templates/index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Includes HTML content from another file in a template.
 * @param {string} filename The name of the file to include.
 * @return {string} The content of the file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Creates the backend Google Sheet database with "Clients" and "Users" sheets.
 * This function is intended to be called once from the UI.
 * @return {string} A success or error message.
 */
function setupDatabase() {
  try {
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();

    // Set up Clients sheet
    const clientsSheet = spreadsheet.getSheetByName('Sheet1');
    clientsSheet.setName('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);

    // Set up Users sheet
    const usersSheet = spreadsheet.insertSheet('Users');
    usersSheet.appendRow(['ID', 'Username', 'PasswordHash']);

    // Add a default user for initial login
    const defaultUserId = Utilities.getUuid();
    const defaultPasswordHash = hashPassword_('admin'); // It's recommended to change this
    usersSheet.appendRow([defaultUserId, 'admin', defaultPasswordHash]);

    PropertiesService.getScriptProperties().setProperty(SCRIPT_PROPERTY_SPREADSHEET_ID, spreadsheetId);

    return `Database created successfully! Spreadsheet ID: ${spreadsheetId}. Default user: admin/admin`;
  } catch (e) {
    return `Error setting up database: ${e.toString()}`;
  }
}

/**
 * Helper function to get the database spreadsheet.
 * @return {Spreadsheet} The spreadsheet object or null if not found.
 */
function getDB_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SCRIPT_PROPERTY_SPREADSHEET_ID);
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }
  return null;
}

/**
 * Hashes a password using SHA-256.
 * @param {string} password The password to hash.
 * @return {string} The hex string of the hashed password.
 */
function hashPassword_(password) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Checks user login credentials against the "Users" sheet.
 * @param {string} username The username.
 * @param {string} password The password.
 * @return {boolean} True if login is successful, false otherwise.
 */
function checkLogin(username, password) {
  const db = getDB_();
  if (!db) return false;

  const usersSheet = db.getSheetByName('Users');
  const data = usersSheet.getDataRange().getValues();
  const passwordHash = hashPassword_(password);

  // Start from row 1 to skip headers
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username && data[i][2] === passwordHash) {
      return true;
    }
  }
  return false;
}

/**
 * Retrieves all clients from the "Clients" sheet.
 * @return {Array<Object>} An array of client objects.
 */
function getClients() {
  const db = getDB_();
  if (!db) return [];

  const sheet = db.getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Remove header row

  return data.map(row => {
    let client = {};
    headers.forEach((header, i) => {
      client[header] = row[i];
    });
    return client;
  });
}

/**
 * Adds or updates a client in the "Clients" sheet.
 * If client.ID is provided, it updates; otherwise, it adds a new client.
 * @param {Object} client The client object to save.
 * @return {Object} The saved client object, including its new ID if added.
 */
function saveClient(client) {
  const db = getDB_();
  const sheet = db.getSheetByName('Clients');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (client.ID) {
    // Update existing client
    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex(row => row[0] == client.ID);
    if (rowIndex > -1) {
      const newRow = headers.map(header => client[header] || '');
      sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([newRow]);
    }
  } else {
    // Add new client
    client.ID = Utilities.getUuid();
    const newRow = headers.map(header => client[header] || '');
    sheet.appendRow(newRow);
  }
  return client;
}

/**
 * Deletes a client from the "Clients" sheet.
 * @param {string} clientId The ID of the client to delete.
 */
function deleteClient(clientId) {
  const db = getDB_();
  const sheet = db.getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();

  const rowIndex = data.findIndex(row => row[0] == clientId);
  if (rowIndex > -1) {
    sheet.deleteRow(rowIndex + 1);
  }
}

/**
 * Generates an email draft using the Gemini API.
 * This is a server-side function to protect the API key.
 * @param {Object} invoiceData The data for the invoice (client, hours, total).
 * @return {string} The generated email draft text or an error message.
 */
function generateEmailDraft(invoiceData) {
  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  try {
    // Note: The API key should be stored in Script Properties for security.
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      return 'Error: La clave de API de Gemini no está configurada en las propiedades del script.';
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [{ "text": prompt }]
      }]
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0]) {
      return result.candidates[0].content.parts[0].text;
    } else {
      return 'No se pudo generar el borrador de correo. La respuesta de la API no fue la esperada.';
    }
  } catch (error) {
    console.error('Error al llamar a la API de Gemini:', error);
    return `Error al generar el borrador: ${error.toString()}`;
  }
}
