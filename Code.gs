const SPREADSHEET_ID_KEY = 'spreadsheetId';

/**
 * @summary Serves the HTML of the web application.
 * @returns {HtmlOutput} The HTML output to be served.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('templates/index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * @summary Includes the content of another HTML file within a template.
 * This allows for modularization of CSS and JavaScript.
 * @param {string} filename The name of the file to include from the 'templates' directory.
 * @returns {string} The content of the requested file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(`templates/${filename}`).getContent();
}

/**
 * @summary Sets up the Google Sheet database for the application.
 * Creates a new spreadsheet with "Clients" and "Users" sheets and necessary headers.
 * Stores the spreadsheet ID in Script Properties for later access.
 * @returns {string} A success message with the new spreadsheet's URL.
 */
function setupDatabase() {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(SPREADSHEET_ID_KEY)) {
    return "La base de datos ya ha sido configurada.";
  }

  const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
  const spreadsheetId = spreadsheet.getId();
  properties.setProperty(SPREADSHEET_ID_KEY, spreadsheetId);

  // Setup Clients sheet
  const clientsSheet = spreadsheet.getSheetByName('Sheet1');
  clientsSheet.setName('Clients');
  clientsSheet.getRange('A1:E1').setValues([['ID', 'Name', 'Email', 'Phone', 'Address']]);
  clientsSheet.setFrozenRows(1);

  // Setup Users sheet
  const usersSheet = spreadsheet.insertSheet('Users');
  usersSheet.getRange('A1:C1').setValues([['ID', 'Email', 'PasswordHash']]);
  usersSheet.setFrozenRows(1);

  return `Base de datos creada exitosamente. Puedes verla aquí: ${spreadsheet.getUrl()}`;
}

/**
 * @summary Retrieves all clients from the "Clients" sheet.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
  const sheet = getSheet_('Clients');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Remove header row

  return data.map(row => {
    const client = {};
    headers.forEach((header, index) => {
      client[header] = row[index];
    });
    return client;
  });
}

/**
 * @summary Adds a new client to the "Clients" sheet.
 * @param {Object} clientData An object containing the new client's information.
 * @returns {Object} The newly created client object, including its new ID.
 */
function addClient(clientData) {
  const sheet = getSheet_('Clients');
  const newId = Utilities.getUuid();
  const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];
  sheet.appendRow(newRow);

  return {
    ID: newId,
    Name: clientData.name,
    Email: clientData.email,
    Phone: clientData.phone,
    Address: clientData.address
  };
}

/**
 * @summary Updates an existing client's information in the "Clients" sheet.
 * @param {Object} clientData An object containing the client's ID and updated information.
 * @returns {Object} The updated client object.
 */
function updateClient(clientData) {
  const sheet = getSheet_('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rowIndex = data.findIndex(row => row[0] === clientData.ID);

  if (rowIndex === -1) {
    throw new Error('Client not found.');
  }

  const newRow = headers.map(header => clientData[header] || '');
  sheet.getRange(rowIndex + 1, 1, 1, newRow.length).setValues([newRow]);

  return clientData;
}

/**
 * @summary Deletes a client from the "Clients" sheet.
 * @param {string} clientId The ID of the client to be deleted.
 * @returns {Object} A success confirmation object.
 */
function deleteClient(clientId) {
  const sheet = getSheet_('Clients');
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] === clientId);

  if (rowIndex === -1) {
    throw new Error('Client not found.');
  }

  sheet.deleteRow(rowIndex + 1);
  return { success: true, deletedId: clientId };
}

/**
 * @summary Calls the Gemini API to generate an email draft.
 * @param {string} prompt The prompt to send to the Gemini API.
 * @returns {string} The generated email text.
 */
function generateEmailDraft_(prompt) {
  // This is a placeholder for the actual API call.
  // In a real application, you would use UrlFetchApp to call the Gemini API
  // and handle the response. The API key should be stored in Script Properties.
  return `Este es un borrador de correo generado por IA basado en el prompt: "${prompt}"`;
}

// ============== AUTHENTICATION ==============

/**
 * @summary Registers a new user.
 * @param {string} email The user's email.
 * @param {string} password The user's plain-text password.
 * @returns {Object} A success object with the user's email.
 */
function registerUser(email, password) {
  const usersSheet = getSheet_('Users');
  const users = usersSheet.getDataRange().getValues();
  const userExists = users.some(row => row[1] === email);

  if (userExists) {
    throw new Error('El correo electrónico ya está registrado.');
  }

  const newId = Utilities.getUuid();
  const passwordHash = hashPassword_(password);
  usersSheet.appendRow([newId, email, passwordHash]);

  return { success: true, email: email };
}

/**
 * @summary Logs a user in.
 * @param {string} email The user's email.
 * @param {string} password The user's plain-text password.
 * @returns {Object} An object with the user's email on successful login.
 */
function loginUser(email, password) {
  const usersSheet = getSheet_('Users');
  const users = usersSheet.getDataRange().getValues();
  users.shift(); // Remove header row

  const passwordHash = hashPassword_(password);

  for (const userRow of users) {
    if (userRow[1] === email && userRow[2] === passwordHash) {
      return { success: true, email: email };
    }
  }

  throw new Error('Correo electrónico o contraseña incorrectos.');
}


// ============== HELPER FUNCTIONS ==============

/**
 * @summary Hashes a password using SHA-256.
 * @param {string} password The plain-text password.
 * @returns {string} The hashed password as a hex string.
 * @private
 */
function hashPassword_(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return digest.map(byte => {
    const hex = (byte & 0xFF).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * @summary A helper function to get a specific sheet from the spreadsheet.
 * @param {string} sheetName The name of the sheet to retrieve.
 * @returns {Sheet|null} The Sheet object or null if the database is not set up.
 * @private
 */
function getSheet_(sheetName) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!spreadsheetId) {
    // Or handle this more gracefully by informing the user they need to run setup.
    throw new Error('Database not set up. Please run the setup function.');
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  return spreadsheet.getSheetByName(sheetName);
}
