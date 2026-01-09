/**
 * @OnlyCurrentDoc
 *
 * The above comment directs App Script to limit the scope of file access for this script
 * to only the current document containing the script.
 */

/**
 * Serves the main HTML page of the web app.
 *
 * @param {Object} e The event parameter for a GET request.
 * @return {HtmlOutput} The HTML page to be displayed.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('templates/index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Includes the content of another HTML file within the main template.
 * This is a common pattern for modularizing HTML in Google Apps Script.
 *
 * @param {string} filename The name of the file to include (without the .html extension).
 * @return {string} The HTML content of the specified file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// =================================================================
// DATABASE SETUP AND UTILITIES
// =================================================================

const SPREADSHEET_ID_KEY = 'spreadsheetId';

/**
 * Creates the initial Google Sheet database and sets it up with the necessary sheets and headers.
 * This function is intended to be run once by the user from the client-side UI.
 */
function setupDatabase() {
  try {
    // Create a new spreadsheet and get its ID
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();

    // Store the spreadsheet ID in script properties for later access
    PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, spreadsheetId);

    // Get the default sheet and rename it to "Clients"
    const clientsSheet = spreadsheet.getSheets()[0];
    clientsSheet.setName('Clients');

    // Set the headers for the "Clients" sheet
    const clientHeaders = ['ID', 'Name', 'Email', 'Phone', 'Address'];
    clientsSheet.getRange(1, 1, 1, clientHeaders.length).setValues([clientHeaders]);

    // Create a "Users" sheet and set its headers
    const usersSheet = spreadsheet.insertSheet('Users');
    const userHeaders = ['ID', 'Username', 'PasswordHash'];
    usersSheet.getRange(1, 1, 1, userHeaders.length).setValues([userHeaders]);

    // Make the header bold
    clientsSheet.getRange(1, 1, 1, clientHeaders.length).setFontWeight('bold');
    usersSheet.getRange(1, 1, 1, userHeaders.length).setFontWeight('bold');


    return { success: true, message: `Database created successfully with ID: ${spreadsheetId}` };
  } catch (error) {
    Logger.log(`Error in setupDatabase: ${error.message}`);
    return { success: false, message: `Failed to create database: ${error.message}` };
  }
}

/**
 * Returns the ID of the connected Google Sheet.
 * @return {string} The spreadsheet ID.
 */
function getSpreadsheetId() {
    return PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
}

/**
 * Helper function to get a specific sheet by name from the active spreadsheet.
 * @param {string} sheetName The name of the sheet to retrieve.
 * @return {Sheet} The Google Sheet object.
 */
function getSheet(sheetName) {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID is not set. Please run the setup.');
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  return spreadsheet.getSheetByName(sheetName);
}


// =================================================================
// CLIENT MANAGEMENT FUNCTIONS
// =================================================================

/**
 * Retrieves all clients from the "Clients" sheet.
 * @return {Array<Object>} An array of client objects.
 */
function getClients() {
  try {
    const sheet = getSheet('Clients');
    const range = sheet.getDataRange();
    const values = range.getValues();

    // Remove header row
    const headers = values.shift();

    const clients = values.map(row => {
      let client = {};
      headers.forEach((header, index) => {
        client[header] = row[index];
      });
      return client;
    });

    return clients;
  } catch (error) {
    return { success: false, message: `Failed to retrieve clients: ${error.message}` };
  }
}

/**
 * Adds a new client to the "Clients" sheet.
 * @param {Object} clientData The client data to add.
 * @return {Object} The newly created client object with its ID.
 */
function addClient(clientData) {
  try {
    const sheet = getSheet('Clients');
    const newId = Utilities.getUuid();

    const newRow = [
      newId,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ];

    sheet.appendRow(newRow);

    // Return the newly created client object
    return {
      ID: newId,
      Name: clientData.name,
      Email: clientData.email,
      Phone: clientData.phone,
      Address: clientData.address
    };
  } catch (error) {
    return { success: false, message: `Failed to add client: ${error.message}` };
  }
}

/**
 * Updates an existing client's information in the "Clients" sheet.
 * @param {Object} clientData The client data to update, including the ID.
 * @return {Object} A success or error message.
 */
function editClient(clientData) {
  try {
    const sheet = getSheet('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColumnIndex = headers.indexOf('ID');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumnIndex] == clientData.ID) {
        // Found the row, now update it
        const nameCol = headers.indexOf('Name');
        const emailCol = headers.indexOf('Email');
        const phoneCol = headers.indexOf('Phone');
        const addressCol = headers.indexOf('Address');

        sheet.getRange(i + 1, nameCol + 1).setValue(clientData.Name);
        sheet.getRange(i + 1, emailCol + 1).setValue(clientData.Email);
        sheet.getRange(i + 1, phoneCol + 1).setValue(clientData.Phone);
        sheet.getRange(i + 1, addressCol + 1).setValue(clientData.Address);

        return { success: true, message: 'Client updated successfully.' };
      }
    }

    return { success: false, message: 'Client not found.' };
  } catch (error) {
    return { success: false, message: `Failed to edit client: ${error.message}` };
  }
}

/**
 * Deletes a client from the "Clients" sheet by their ID.
 * @param {string} clientId The ID of the client to delete.
 * @return {Object} A success or error message.
 */
function deleteClient(clientId) {
  try {
    const sheet = getSheet('Clients');
    const data = sheet.getDataRange().getValues();
    const idColumnIndex = data[0].indexOf('ID');

    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][idColumnIndex] == clientId) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Client deleted successfully.' };
      }
    }

    return { success: false, message: 'Client not found.' };
  } catch (error) {
    return { success: false, message: `Failed to delete client: ${error.message}` };
  }
}

// =================================================================
// USER AUTHENTICATION
// =================================================================

/**
 * Hashes a password using SHA-256 for secure storage.
 * @param {string} password The plain-text password.
 * @return {string} The hashed password as a hex string.
 */
function hashPassword(password) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Checks if a user's credentials are valid.
 * @param {string} username The user's username.
 * @param {string} password The user's password.
 * @return {Object} An object indicating success or failure.
 */
function checkUser(username, password) {
  try {
    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameCol = headers.indexOf('Username');
    const passwordHashCol = headers.indexOf('PasswordHash');

    const passwordHash = hashPassword(password);

    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameCol] === username && data[i][passwordHashCol] === passwordHash) {
        return { success: true };
      }
    }
    return { success: false, message: 'Invalid username or password.' };
  } catch (error) {
    return { success: false, message: `Login error: ${error.message}` };
  }
}

/**
 * Creates a new user in the "Users" sheet.
 * @param {string} username The desired username.
 * @param {string} password The desired password.
 * @return {Object} An object indicating success or failure.
 */
function createUser(username, password) {
  try {
    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();
    const usernameCol = data[0].indexOf('Username');

    // Check if user already exists
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameCol] === username) {
        return { success: false, message: 'User already exists.' };
      }
    }

    const newId = Utilities.getUuid();
    const passwordHash = hashPassword(password);
    sheet.appendRow([newId, username, passwordHash]);

    return { success: true, message: 'User created successfully.' };
  } catch (error) {
    return { success: false, message: `Failed to create user: ${error.message}` };
  }
}

// =================================================================
// AI & EXTERNAL SERVICES
// =================================================================

const GEMINI_API_KEY_KEY = 'geminiApiKey';

/**
 * Generates a professional email draft for an invoice using the Gemini API.
 * @param {string} clientName The name of the client.
 * @param {string} clientEmail The email of the client.
 * @param {number} hours The number of hours worked.
 * @param {number} total The total amount of the invoice.
 * @return {Object} An object containing the success status and the email draft or an error message.
 */
function generateEmailDraft(clientName, clientEmail, hours, total) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(GEMINI_API_KEY_KEY);
  if (!apiKey) {
    return { success: false, message: 'Gemini API key is not set. Please configure it in the script properties.' };
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${clientName} y su correo es ${clientEmail}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  try {
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

    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates[0] && result.candidates[0].content.parts[0]) {
      const draft = result.candidates[0].content.parts[0].text;
      return { success: true, draft: draft };
    } else {
      return { success: false, message: 'No se pudo generar el borrador de correo. La respuesta de la API no fue la esperada.' };
    }
  } catch (error) {
    return { success: false, message: `Error al llamar a la API de Gemini: ${error.message}` };
  }
}
