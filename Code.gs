// Constants for sheet names
const USERS_SHEET = 'Users';
const CLIENTS_SHEET = 'Clients';
const INVOICES_SHEET = 'Invoices';

/**
 * Serves the HTML of the web application.
 * This function is automatically called when the web app URL is accessed.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Includes the content of another file into the HTML template.
 * This is a helper function used within the HTML templates.
 * @param {string} filename The name of the file to include (e.g., 'styles' or 'scripts').
 * @return {string} The content of the specified file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Sets up the required sheets in the Google Sheet.
 * Creates 'Users', 'Clients', and 'Invoices' sheets with headers
 * and adds a default admin user if the 'Users' sheet is new.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Create Users sheet if it doesn't exist
  if (!ss.getSheetByName(USERS_SHEET)) {
    const userSheet = ss.insertSheet(USERS_SHEET);
    userSheet.appendRow(['ID', 'Username', 'PasswordHash', 'Salt']);
    // Add a default admin user
    const salt = Utilities.getUuid();
    const passwordHash = hashPassword('admin123', salt);
    userSheet.appendRow([1, 'admin', passwordHash, salt]);
  }

  // Create Clients sheet if it doesn't exist
  if (!ss.getSheetByName(CLIENTS_SHEET)) {
    const clientSheet = ss.insertSheet(CLIENTS_SHEET);
    clientSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  }

  // Create Invoices sheet if it doesn't exist
  if (!ss.getSheetByName(INVOICES_SHEET)) {
    const invoiceSheet = ss.insertSheet(INVOICES_SHEET);
    invoiceSheet.appendRow(['ID', 'ClientID', 'ClientName', 'Date', 'DurationHours', 'HourlyRate', 'TotalAmount']);
  }

  return 'Setup complete. Sheets created successfully.';
}

/**
 * Hashes a password using SHA-256 with a given salt.
 * @param {string} password The plain-text password.
 * @param {string} salt The salt for hashing.
 * @return {string} The hexadecimal representation of the hash.
 */
function hashPassword(password, salt) {
  const toHash = password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, toHash);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Checks user login credentials.
 * @param {string} username The username.
 * @param {string} password The password.
 * @return {Object} An object with a 'success' status and a message.
 */
function checkLogin(username, password) {
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  const data = userSheet.getDataRange().getValues();
  // Find user row (skip header)
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username) {
      const storedHash = data[i][2];
      const salt = data[i][3];
      const inputHash = hashPassword(password, salt);
      if (inputHash === storedHash) {
        return { success: true, message: 'Login successful.' };
      }
    }
  }
  return { success: false, message: 'Invalid username or password.' };
}

/**
 * Generates a new unique ID for a record in a sheet.
 * It correctly handles empty sheets or sheets with only a header.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to generate an ID for.
 * @return {number} The new unique ID.
 */
function getNewId(sheet) {
  const lastRow = sheet.getLastRow();
  // If there's only a header or the sheet is empty
  if (lastRow < 2) {
    return 1;
  }
  // Get all ID values from the first column
  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const ids = data.flat().filter(id => typeof id === 'number' && id !== '');

  if (ids.length === 0) {
    return 1;
  }

  const maxId = Math.max(...ids);
  return maxId + 1;
}


/**
 * Retrieves all clients from the 'Clients' sheet.
 * @return {Array<Object>} An array of client objects.
 */
function getClients() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CLIENTS_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Remove headers
  return data.map(row => {
    return {
      id: row[0],
      name: row[1],
      email: row[2],
      phone: row[3],
      address: row[4]
    };
  });
}

/**
 * Adds a new client to the 'Clients' sheet.
 * @param {Object} clientData The client's data.
 * @return {Object} The client object that was added, including its new ID.
 */
function addClient(clientData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CLIENTS_SHEET);
  const newId = getNewId(sheet);
  sheet.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
  return { ...clientData, id: newId };
}

/**
 * Updates an existing client's information.
 * @param {Object} clientData The client's data, including ID.
 * @return {Object} A status object.
 */
function updateClient(clientData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CLIENTS_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == clientData.id) {
      sheet.getRange(i + 1, 2, 1, 4).setValues([[clientData.name, clientData.email, clientData.phone, clientData.address]]);
      return { success: true, message: 'Client updated.' };
    }
  }
  return { success: false, message: 'Client not found.' };
}

/**
 * Deletes a client from the 'Clients' sheet.
 * @param {number} clientId The ID of the client to delete.
 * @return {Object} A status object.
 */
function deleteClient(clientId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CLIENTS_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == clientId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Client deleted.' };
    }
  }
  return { success: false, message: 'Client not found.' };
}

/**
 * Saves a new invoice to the 'Invoices' sheet.
 * @param {Object} invoiceData The invoice data.
 * @return {Object} A status object.
 */
function saveInvoice(invoiceData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INVOICES_SHEET);
  const newId = getNewId(sheet);
  sheet.appendRow([
    newId,
    invoiceData.client.id,
    invoiceData.client.name,
    new Date(),
    invoiceData.hours,
    invoiceData.rate,
    invoiceData.total
  ]);
  return { success: true, message: 'Invoice saved.' };
}
