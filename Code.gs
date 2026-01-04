function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Creates a new Google Sheet and sets up the "Clients" and "Users" tables.
 * Stores the new sheet's ID in script properties.
 */
function setupDatabase() {
  try {
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();

    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

    const clientsSheet = spreadsheet.getSheetByName('Sheet1');
    clientsSheet.setName('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);

    const usersSheet = spreadsheet.insertSheet('Users');
    usersSheet.appendRow(['ID', 'Username', 'PasswordHash', 'Salt']);

    return { success: true, message: 'Database created successfully!', spreadsheetId: spreadsheetId };
  } catch (e) {
    return { success: false, message: 'Error creating database: ' + e.toString() };
  }
}

function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not found. Please set up the database first.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getUsersSheet() {
  return getSpreadsheet().getSheetByName('Users');
}

function getClientsSheet() {
  return getSpreadsheet().getSheetByName('Clients');
}

/**
 * Hashes a password with a given salt.
 * @param {string} password The password to hash.
 * @param {string} salt The salt to use.
 * @return {string} The hashed password.
 */
function hashPassword(password, salt) {
  const toHash = password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, toHash);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Registers a new user.
 * @param {string} username The username.
 * @param {string} password The password.
 * @return {object} A result object.
 */
function registerUser(username, password) {
  try {
    const sheet = getUsersSheet();
    const data = sheet.getDataRange().getValues();
    const existingUser = data.find(row => row[1] === username);
    if (existingUser) {
      return { success: false, message: 'Username already exists.' };
    }

    const salt = Utilities.getUuid();
    const passwordHash = hashPassword(password, salt);
    const newUserId = Utilities.getUuid();

    sheet.appendRow([newUserId, username, passwordHash, salt]);
    return { success: true, message: 'User registered successfully.' };
  } catch (e) {
    return { success: false, message: 'Error registering user: ' + e.toString() };
  }
}

/**
 * Logs a user in.
 * @param {string} username The username.
 * @param {string} password The password.
 * @return {object} A result object.
 */
function login(username, password) {
  try {
    const sheet = getUsersSheet();
    const data = sheet.getDataRange().getValues();
    const userRow = data.find(row => row[1] === username);

    if (!userRow) {
      return { success: false, message: 'Invalid username or password.' };
    }

    const storedHash = userRow[2];
    const salt = userRow[3];
    const passwordHash = hashPassword(password, salt);

    if (passwordHash === storedHash) {
      return { success: true, message: 'Login successful.' };
    } else {
      return { success: false, message: 'Invalid username or password.' };
    }
  } catch (e) {
    return { success: false, message: 'Error logging in: ' + e.toString() };
  }
}

/**
 * Retrieves all clients from the "Clients" sheet.
 * @return {object} An object containing the clients data or an error message.
 */
function getClients() {
  try {
    const sheet = getClientsSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const clients = data.map(row => {
      const client = {};
      headers.forEach((header, index) => {
        client[header] = row[index];
      });
      return client;
    });
    return { success: true, data: clients };
  } catch (e) {
    return { success: false, message: 'Error getting clients: ' + e.toString() };
  }
}

/**
 * Adds a new client to the "Clients" sheet.
 * @param {object} clientData The client's data.
 * @return {object} A result object.
 */
function addClient(clientData) {
  try {
    const sheet = getClientsSheet();
    const newClientId = Utilities.getUuid();
    sheet.appendRow([newClientId, clientData.name, clientData.email, clientData.phone, clientData.address]);
    return { success: true, message: 'Client added successfully.', clientId: newClientId };
  } catch (e) {
    return { success: false, message: 'Error adding client: ' + e.toString() };
  }
}

/**
 * Updates an existing client in the "Clients" sheet.
 * @param {object} clientData The client's new data, including ID.
 * @return {object} A result object.
 */
function updateClient(clientData) {
  try {
    const sheet = getClientsSheet();
    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex(row => row[0] === clientData.ID);

    if (rowIndex > 0) { // rowIndex > 0 to skip header
      sheet.getRange(rowIndex + 1, 2).setValue(clientData.Name);
      sheet.getRange(rowIndex + 1, 3).setValue(clientData.Email);
      sheet.getRange(rowIndex + 1, 4).setValue(clientData.Phone);
      sheet.getRange(rowIndex + 1, 5).setValue(clientData.Address);
      return { success: true, message: 'Client updated successfully.' };
    } else {
      return { success: false, message: 'Client not found.' };
    }
  } catch (e) {
    return { success: false, message: 'Error updating client: ' + e.toString() };
  }
}

/**
 * Deletes a client from the "Clients" sheet.
 * @param {string} clientId The ID of the client to delete.
 * @return {object} A result object.
 */
function deleteClient(clientId) {
  try {
    const sheet = getClientsSheet();
    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex(row => row[0] === clientId);

    if (rowIndex > 0) { // rowIndex > 0 to skip header
      sheet.deleteRow(rowIndex + 1);
      return { success: true, message: 'Client deleted successfully.' };
    } else {
      return { success: false, message: 'Client not found.' };
    }
  } catch (e) {
    return { success: false, message: 'Error deleting client: ' + e.toString() };
  }
}
