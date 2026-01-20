function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// PropertiesService key for storing the spreadsheet ID
const SPREADSHEET_ID_KEY = 'spreadsheetId';

/**
 * Creates the database spreadsheet and sets up the initial tables (sheets).
 * This function should be run manually from the Apps Script editor once,
 * or triggered by a button in the UI.
 * It also sets up a default admin user.
 * @returns {string} A success or error message.
 */
function setupDatabase() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const existingId = properties.getProperty(SPREADSHEET_ID_KEY);
    if (existingId) {
      // Check if the file still exists to avoid dead links
      try {
        SpreadsheetApp.openById(existingId);
        return 'La base de datos ya ha sido configurada. ID: ' + existingId;
      } catch (e) {
        // The spreadsheet was deleted, so we can proceed to create a new one.
      }
    }

    // Create a new spreadsheet
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro DB');
    const spreadsheetId = spreadsheet.getId();

    // Store the new spreadsheet's ID
    properties.setProperty(SPREADSHEET_ID_KEY, spreadsheetId);

    // Set up the "Clients" sheet
    const clientsSheet = spreadsheet.getSheets()[0];
    clientsSheet.setName('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    clientsSheet.setFrozenRows(1);

    // Set up the "Users" sheet
    const usersSheet = spreadsheet.insertSheet('Users');
    usersSheet.appendRow(['ID', 'Name', 'Email', 'Password']);
    usersSheet.setFrozenRows(1);

    // Add a default user with a hashed password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('admin', salt);
    usersSheet.appendRow([1, 'Admin User', 'admin@timebill.pro', hashedPassword]);

    return '¡Base de datos configurada exitosamente! ID: ' + spreadsheetId;
  } catch (e) {
    // Log the error for debugging
    console.error('Error in setupDatabase: ' + e.toString());
    return 'Error al configurar la base de datos: ' + e.toString();
  }
}

/**
 * Retrieves the database spreadsheet object.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The spreadsheet object.
 * @throws {Error} If the spreadsheet is not set up.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!spreadsheetId) {
    throw new Error('La base de datos no está configurada. Por favor, ejecute la configuración primero.');
  }
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (e) {
    throw new Error('No se pudo acceder a la hoja de cálculo. Es posible que haya sido eliminada o que los permisos hayan cambiado.');
  }
}

/**
 * Retrieves all clients from the "Clients" sheet.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header row
    return data.map(row => {
      const client = {};
      headers.forEach((header, i) => {
        client[header] = row[i];
      });
      return client;
    });
  } catch (e) {
    return []; // Return empty array on error
  }
}

/**
 * Adds a new client to the "Clients" sheet.
 * @param {Object} clientData - The client's data.
 * @returns {Object} The newly added client.
 */
function addClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const allData = sheet.getDataRange().getValues();
  const newId = allData.length > 1 ? Math.max(...allData.slice(1).map(row => row[0])) + 1 : 1;

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
 * Updates an existing client's information.
 * @param {Object} clientData - The client data to update, must include ID.
 * @returns {Object} The updated client data.
 */
function updateClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == clientData.ID);

  if (rowIndex === -1) {
    throw new Error('Client not found');
  }

  // Update the row (ID, Name, Email, Phone, Address)
  sheet.getRange(rowIndex + 1, 2).setValue(clientData.Name);
  sheet.getRange(rowIndex + 1, 3).setValue(clientData.Email);
  sheet.getRange(rowIndex + 1, 4).setValue(clientData.Phone);
  sheet.getRange(rowIndex + 1, 5).setValue(clientData.Address);

  return clientData;
}

/**
 * Deletes a client by their ID.
 * @param {number} clientId - The ID of the client to delete.
 * @returns {Object} A success message.
 */
function deleteClient(clientId) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == clientId);

  if (rowIndex === -1) {
    throw new Error('Client not found');
  }

  sheet.deleteRow(rowIndex + 1);
  return { success: true };
}

/**
 * Attempts to log in a user.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {Object|null} The user object if successful, otherwise null.
 */
function loginUser(email, password) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header row

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const hashedPassword = row[3];
      if (row[2] === email && bcrypt.compareSync(password, hashedPassword)) {
        const user = {};
        headers.forEach((header, j) => {
          user[header] = row[j];
        });
        return user;
      }
    }
    return null; // User not found or password incorrect
  } catch(e) {
    console.error("Login error: " + e.toString());
    return null; // Return null on any error (e.g., sheet not found)
  }
}

/**
 * Checks if the database spreadsheet is configured.
 * @returns {boolean} True if the spreadsheet ID is stored, false otherwise.
 */
function isDatabaseSetup() {
  return !!PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
}
