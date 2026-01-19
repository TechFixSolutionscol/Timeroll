
function doGet(e) {
  return HtmlService.createTemplateFromFile('index').evaluate();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Creates the initial Google Sheet database and sets it up with the required sheets and headers.
 * This function is intended to be run once by the user.
 * @returns {string} A success or error message.
 */
function setupDatabase() {
  try {
    const existingSpreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    if (existingSpreadsheetId) {
      // If the sheet exists, just return a message. Don't create a new one.
      return 'La base de datos ya ha sido configurada.';
    }

    // Create a new Spreadsheet
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheet.getId());

    // Create and setup the 'Clients' sheet
    const clientsSheet = spreadsheet.insertSheet('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);

    // Create and setup the 'Users' sheet
    const usersSheet = spreadsheet.insertSheet('Users');
    usersSheet.appendRow(['Username', 'PasswordHash', 'Salt']);
    // Add a default user for demo purposes
    const salt = generateSalt();
    usersSheet.appendRow(['demo', hashPassword('demo', salt), salt]);

    // Remove the default 'Sheet1'
    spreadsheet.deleteSheet(spreadsheet.getSheetByName('Sheet1'));

    return `Base de datos creada exitosamente. ID: ${spreadsheet.getId()}`;
  } catch (e) {
    Logger.log(e);
    return `Error al configurar la base de datos: ${e.message}`;
  }
}

/**
 * A helper function to get the active spreadsheet.
 * @returns {Spreadsheet} The spreadsheet object.
 * @throws {Error} If the database has not been set up.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('La base de datos no ha sido configurada. Por favor, haz clic en "Configurar Base de Datos".');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * Generates a random salt.
 * @returns {string} A random salt.
 */
function generateSalt() {
  const salt = Utilities.getUuid();
  return salt;
}

/**
 * Hashes a password using SHA-256 with a salt.
 * @param {string} password The password to hash.
 * @param {string} salt The salt to use.
 * @returns {string} The hexadecimal representation of the hashed password.
 */
function hashPassword(password, salt) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Attempts to log in a user.
 * @param {string} username The username.
 * @param {string} password The user's password.
 * @returns {boolean} True if login is successful, false otherwise.
 */
function login(username, password) {
  try {
    const usersSheet = getSpreadsheet().getSheetByName('Users');
    const data = usersSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === username) {
        const salt = data[i][2];
        const passwordHash = hashPassword(password, salt);
        if (data[i][1] === passwordHash) {
          const userProperties = PropertiesService.getUserProperties();
          userProperties.setProperty('loggedIn', 'true');
          return true;
        }
      }
    }
    return false;
  } catch (e) {
    Logger.log(e);
    return false;
  }
}

/**
 * Checks if the user is currently logged in.
 * @returns {boolean} True if the user has a valid session.
 */
function checkAuth() {
  return PropertiesService.getUserProperties().getProperty('loggedIn') === 'true';
}


/**
 * Retrieves all clients from the 'Clients' sheet.
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
    Logger.log(e);
    return []; // Return empty array on error
  }
}

/**
 * Adds a new client to the 'Clients' sheet.
 * @param {Object} clientData The client data to add.
 * @returns {Object} The client object that was added, including the new ID.
 */
function addClient(clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const idColumn = sheet.getRange("A2:A").getValues().flat().filter(String);
    const newId = idColumn.length > 0 ? Math.max(...idColumn) + 1 : 1;

    const newRow = [
      newId,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ];

    sheet.appendRow(newRow);

    return {
      ID: newId,
      Name: clientData.name,
      Email: clientData.email,
      Phone: clientData.phone,
      Address: clientData.address
    };
  } catch (e) {
    Logger.log(e);
    throw new Error(`Error adding client: ${e.message}`);
  }
}

/**
 * Updates an existing client in the 'Clients' sheet.
 * @param {Object} clientData The client data to update, must include an ID.
 * @returns {Object} The updated client object.
 */
function updateClient(clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();

    const rowIndex = data.findIndex(row => row[0] == clientData.id);

    if (rowIndex === -1) {
      throw new Error('Client not found.');
    }

    const rowToUpdate = rowIndex + 1; // 1-based index
    sheet.getRange(rowToUpdate, 2).setValue(clientData.name);
    sheet.getRange(rowToUpdate, 3).setValue(clientData.email);
    sheet.getRange(rowToUpdate, 4).setValue(clientData.phone);
    sheet.getRange(rowToUpdate, 5).setValue(clientData.address);

    return {
      ID: clientData.id,
      Name: clientData.name,
      Email: clientData.email,
      Phone: clientData.phone,
      Address: clientData.address
    };
  } catch (e) {
    Logger.log(e);
    throw new Error(`Error updating client: ${e.message}`);
  }
}

/**
 * Deletes a client from the 'Clients' sheet.
 * @param {number} clientId The ID of the client to delete.
 * @returns {boolean} True if deletion was successful.
 */
function deleteClient(clientId) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();

    const rowIndex = data.findIndex(row => row[0] == clientId);

    if (rowIndex === -1) {
      throw new Error('Client not found.');
    }

    const rowToDelete = rowIndex + 1; // 1-based index
    sheet.deleteRow(rowToDelete);

    return true;
  } catch (e) {
    Logger.log(e);
    throw new Error(`Error deleting client: ${e.message}`);
  }
}
