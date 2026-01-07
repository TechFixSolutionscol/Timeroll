function doGet() {
  return HtmlService.createTemplateFromFile('templates/index').evaluate()
    .setTitle('TimeBill Pro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(Utilities.formatString('templates/%s', filename)).getContent();
}

// =====================================================================================
// HELPER FUNCTIONS
// =====================================================================================

/**
 * Gets the active spreadsheet using the ID stored in Script Properties.
 * @returns {Spreadsheet} The Google Spreadsheet object or null if not found.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    // Return null or throw an error if the database hasn't been set up.
    return null;
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * Hashes a password using SHA-256.
 * @param {string} password The password to hash.
 * @returns {string} The hexadecimal representation of the hashed password.
 */
function hashPassword(password) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}


// =====================================================================================
// DATABASE SETUP
// =====================================================================================

/**
 * Creates the Google Sheet database and initializes it with the required tables and headers.
 * This function is called from the frontend by the user.
 */
function setupDatabase() {
  try {
    // Create a new spreadsheet
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();

    // Get the default sheet and rename it to 'Clients'
    const clientsSheet = spreadsheet.getSheets()[0];
    clientsSheet.setName('Clients');
    const clientHeaders = ['ID', 'Name', 'Email', 'Phone', 'Address'];
    clientsSheet.getRange(1, 1, 1, clientHeaders.length).setValues([clientHeaders]);

    // Create a new sheet for 'Users'
    const usersSheet = spreadsheet.insertSheet('Users');
    const userHeaders = ['ID', 'Username', 'Password'];
    usersSheet.getRange(1, 1, 1, userHeaders.length).setValues([userHeaders]);

    // Create an admin user for initial login
    const adminId = Utilities.getUuid();
    const adminUsername = 'admin';
    const adminPassword = 'password123'; // Simple default password
    const hashedPassword = hashPassword(adminPassword);
    usersSheet.appendRow([adminId, adminUsername, hashedPassword]);


    // Store the spreadsheet ID in script properties
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

    return { success: true, message: `Database created! Login with username: "${adminUsername}" and password: "${adminPassword}"`, spreadsheetId: spreadsheetId };
  } catch (e) {
    Logger.log(e);
    return { success: false, message: 'An error occurred during setup: ' + e.message };
  }
}

// =====================================================================================
// AUTHENTICATION
// =====================================================================================

/**
 * Logs a user in by checking their credentials against the Users sheet.
 * @param {string} username The user's username.
 * @param {string} password The user's password.
 * @returns {object} An object indicating success or failure.
 */
function login(username, password) {
  const ss = getSpreadsheet();
  if (!ss) {
    return { success: false, message: 'Database not set up. Please set it up first.' };
  }
  const usersSheet = ss.getSheetByName('Users');
  const data = usersSheet.getDataRange().getValues();
  const hashedPassword = hashPassword(password);

  // Skip header row and find the user
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username && data[i][2] === hashedPassword) {
      return { success: true, message: 'Login successful!' };
    }
  }

  return { success: false, message: 'Invalid username or password.' };
}

// =====================================================================================
// CLIENT CRUD OPERATIONS
// =====================================================================================

/**
 * Helper function to convert 2D array from sheet to an array of objects.
 * @param {Array<Array>} data The 2D array from the sheet.
 * @returns {Array<Object>} An array of client objects.
 */
function sheetDataToObjects(data) {
  const headers = data[0];
  const objects = [];
  for (let i = 1; i < data.length; i++) {
    const object = {};
    for (let j = 0; j < headers.length; j++) {
      object[headers[j]] = data[i][j];
    }
    objects.push(object);
  }
  return objects;
}

/**
 * Gets all clients from the 'Clients' sheet.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
  const ss = getSpreadsheet();
  if (!ss) return [];
  const clientsSheet = ss.getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  return sheetDataToObjects(data);
}

/**
 * Adds a new client to the 'Clients' sheet.
 * @param {Object} clientData The client data to add.
 * @returns {Object} The newly created client object.
 */
function addClient(clientData) {
  const ss = getSpreadsheet();
  const clientsSheet = ss.getSheetByName('Clients');
  const newId = Utilities.getUuid();
  const newRow = [
    newId,
    clientData.name,
    clientData.email,
    clientData.phone,
    clientData.address
  ];
  clientsSheet.appendRow(newRow);
  return { ID: newId, ...clientData };
}

/**
 * Updates an existing client in the 'Clients' sheet.
 * @param {Object} clientData The client data to update, including the ID.
 * @returns {Object} The updated client object.
 */
function updateClient(clientData) {
  const ss = getSpreadsheet();
  const clientsSheet = ss.getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();

  const clientRowIndex = data.findIndex(row => row[0] === clientData.ID);

  if (clientRowIndex > 0) { // check if client was found
    const newRow = [
      clientData.ID,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ];
    clientsSheet.getRange(clientRowIndex + 1, 1, 1, newRow.length).setValues([newRow]);
    return clientData;
  }
  throw new Error('Client not found');
}

// =====================================================================================
// AI EMAIL GENERATION
// =====================================================================================

/**
 * Generates an email draft using the Gemini API.
 * The API key is stored in script properties for security.
 * @param {Object} invoiceData The data for the invoice (client, hours, total).
 * @returns {string} The generated email draft as a string.
 */
function generateEmailDraft(invoiceData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
  if (!apiKey) {
    throw new Error('Gemini API key is not set in script properties.');
  }

  const { client, hours, total } = invoiceData;

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

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
    muteHttpExceptions: true // Prevents throwing an exception for non-2xx status codes
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() === 200 && result.candidates && result.candidates[0].content.parts[0].text) {
      return result.candidates[0].content.parts[0].text;
    } else {
      Logger.log('Gemini API Error Response: ' + response.getContentText());
      throw new Error('Failed to generate email draft from API. Response: ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('Error calling Gemini API: ' + e.toString());
    throw new Error('An error occurred while communicating with the AI service.');
  }
}

/**
 * Deletes a client from the 'Clients' sheet by ID.
 * @param {string} clientId The ID of the client to delete.
 * @returns {Object} An object indicating success.
 */
function deleteClient(clientId) {
  const ss = getSpreadsheet();
  const clientsSheet = ss.getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();

  // Find the row index of the client to delete
  const clientRowIndex = data.findIndex(row => row[0] === clientId);

  if (clientRowIndex > 0) { // check if client was found
    clientsSheet.deleteRow(clientRowIndex + 1);
    return { success: true };
  }
  throw new Error('Client not found');
}
