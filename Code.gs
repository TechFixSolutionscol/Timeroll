// Global constant for spreadsheet ID to avoid repeated property lookups
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('spreadsheetId');

/**
 * Main function to serve the web app.
 * @param {Object} e The event parameter for a web app doGet request.
 * @returns {HtmlOutput} The HTML output for the web app.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('templates/index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Includes the content of another HTML file within a template.
 * This is used to modularize CSS and JavaScript.
 * @param {string} filename The name of the file to include from the 'templates' folder.
 * @returns {string} The content of the specified file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(`templates/${filename}`).getContent();
}

/**
* Helper function to get the spreadsheet instance.
* Caching the spreadsheet instance could be a future optimization.
* @returns {Spreadsheet} The active spreadsheet instance.
*/
function _getDb() {
    if (!SPREADSHEET_ID) {
        throw new Error('Spreadsheet ID is not set. Please run the setup function.');
    }
    try {
        return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
        console.error("Failed to open spreadsheet with ID: " + SPREADSHEET_ID);
        throw new Error('Could not open the database. It may have been deleted or permissions changed.');
    }
}


/**
 * Retrieves all clients from the "Clients" sheet.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
  try {
    const sheet = _getDb().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header row

    // Convert 2D array to an array of objects
    return data.map(row => {
      let client = {};
      headers.forEach((header, i) => {
        client[header] = row[i];
      });
      return client;
    });
  } catch (e) {
    console.error('Error in getClients: ' + e.toString());
    return []; // Return empty array on error
  }
}

/**
 * Adds a new client to the "Clients" sheet.
 * @param {Object} clientData An object containing the client's details.
 * @returns {Object} An object indicating success or failure.
 */
function addClient(clientData) {
  try {
    const sheet = _getDb().getSheetByName('Clients');
    const newId = Utilities.getUuid();
    sheet.appendRow([
      newId,
      clientData.Name,
      clientData.Email,
      clientData.Phone,
      clientData.Address
    ]);
    return { success: true, newClientId: newId };
  } catch (e) {
    console.error('Error in addClient: ' + e.toString());
    return { success: false, message: 'Failed to add client: ' + e.message };
  }
}

/**
 * Updates an existing client's information in the "Clients" sheet.
 * @param {Object} clientData An object containing the client's updated details, including ID.
 * @returns {Object} An object indicating success or failure.
 */
function updateClient(clientData) {
  try {
    const sheet = _getDb().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColumnIndex = headers.indexOf('ID');

    // Find the row to update
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumnIndex] == clientData.ID) {
        // Construct the new row based on headers order
        let newRow = headers.map(header => clientData[header] || data[i][headers.indexOf(header)]);
        sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
        return { success: true };
      }
    }
    return { success: false, message: 'Client not found.' };
  } catch (e) {
    console.error('Error in updateClient: ' + e.toString());
    return { success: false, message: 'Failed to update client: ' + e.message };
  }
}

/**
 * Deletes a client from the "Clients" sheet by their ID.
 * @param {string} clientId The ID of the client to delete.
 * @returns {Object} An object indicating success or failure.
 */
function deleteClient(clientId) {
  try {
    const sheet = _getDb().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const idColumnIndex = data[0].indexOf('ID');

    // Find the row to delete (iterate backwards to avoid index shifting)
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][idColumnIndex] == clientId) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, message: 'Client not found.' };
  } catch (e) {
    console.error('Error in deleteClient: ' + e.toString());
    return { success: false, message: 'Failed to delete client: ' + e.message };
  }
}

/**
 * Authenticates a user against the "Users" sheet.
 * @param {string} username The user's username.
 * @param {string} password The user's plain-text password.
 * @returns {Object} An object indicating success and a message.
 */
function login(username, password) {
  try {
    const sheet = _getDb().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header

    const usernameIndex = headers.indexOf('Username');
    const passwordHashIndex = headers.indexOf('PasswordHash');

    // Compute the hash of the provided password
    const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password)
                                .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                                .join('');

    // Find the user and check the password hash
    for (let i = 0; i < data.length; i++) {
      if (data[i][usernameIndex] === username && data[i][passwordHashIndex] === passwordHash) {
        return { success: true, message: 'Login successful.' };
      }
    }

    return { success: false, message: 'Invalid username or password.' };
  } catch (e) {
    console.error('Error in login: ' + e.toString());
    return { success: false, message: 'An error occurred during login: ' + e.message };
  }
}


/**
 * Creates the Google Sheet database and initializes it with headers.
 * This function is intended to be called once from the client-side UI.
 */
function setupDatabase() {
  try {
    // Check if the spreadsheet ID already exists to prevent overwriting.
    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty('spreadsheetId');
    if (spreadsheetId) {
      try {
        SpreadsheetApp.openById(spreadsheetId);
        return { success: true, message: 'La base de datos ya parece estar configurada.', spreadsheetId: spreadsheetId };
      } catch (e) {
        console.warn('Could not open existing spreadsheet ID. A new one will be created. Error: ' + e.message);
      }
    }

    // Create a new spreadsheet and name it.
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const newSpreadsheetId = spreadsheet.getId();

    // Create the "Clients" sheet and set headers.
    const clientsSheet = spreadsheet.insertSheet('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);

    // Create the "Users" sheet and set headers.
    const usersSheet = spreadsheet.insertSheet('Users');
    usersSheet.appendRow(['ID', 'Username', 'PasswordHash']);

    // Add a sample user for testing.
    const userId = Utilities.getUuid();
    const username = 'admin';
    const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'admin123')
                                  .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                                  .join('');
    usersSheet.appendRow([userId, username, passwordHash]);

    // Delete the default "Sheet1"
    spreadsheet.deleteSheet(spreadsheet.getSheetByName('Sheet1'));

    // Store the new spreadsheet's ID in Script Properties.
    properties.setProperty('spreadsheetId', newSpreadsheetId);

    console.log('Database setup complete. Spreadsheet ID: ' + newSpreadsheetId);

    return { success: true, message: '¡Base de datos creada exitosamente!', spreadsheetId: newSpreadsheetId };
  } catch (e) {
    console.error('Error in setupDatabase: ' + e.toString());
    return { success: false, message: 'Ocurrió un error al crear la base de datos: ' + e.message };
  }
}
