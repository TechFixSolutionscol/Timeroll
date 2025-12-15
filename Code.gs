// =================================================================================================
//  TimeBill Pro - Google Apps Script Backend
// =================================================================================================
//  INFO:
//  - This script acts as the backend API for the TimeBill Pro web application.
//  - It connects to a Google Sheet which serves as the database.
//  - It must be deployed as a Web App to function.
//
//  SECURITY:
//  - The SPREADSHEET_URL and GEMINI_API_KEY are stored as Script Properties to keep them secure.
//  - To set them, go to Project Settings > Script Properties.
// =================================================================================================

// --- SCRIPT PROPERTIES ---
// Retrieve sensitive data from Script Properties. This is more secure than hardcoding.
const SPREADSHEET_URL = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_URL');
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);

/**
 * @description Main function that handles all POST requests from the web app.
 * Acts as a router to call the appropriate function based on the 'action' parameter.
 * @param {Object} e - The event parameter containing the request data.
 * @returns {ContentService.TextOutput} - A JSON response.
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    let result;

    switch (body.action) {
      case 'setup':
        result = setup();
        break;
      case 'login':
        result = checkLogin(body.data);
        break;
      case 'getClients':
        result = getClients();
        break;
      case 'addClient':
        result = addClient(body.data);
        break;
      case 'updateClient':
        result = updateClient(body.data);
        break;
      case 'deleteClient':
        result = deleteClient(body.data.id);
        break;
      case 'addInvoice':
        result = addInvoice(body.data);
        break;
      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log(error.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =================================================================================================
//  DATABASE SETUP
// =================================================================================================

/**
 * @description Creates the necessary sheets and headers in the spreadsheet if they don't exist.
 * This function is triggered by a button in the web app's UI.
 * @returns {String} - A confirmation message.
 */
function setup() {
  const sheetNames = {
    clients: 'Clients',
    invoices: 'Invoices',
    users: 'Users'
  };

  // Create Clients sheet
  if (!ss.getSheetByName(sheetNames.clients)) {
    const clientSheet = ss.insertSheet(sheetNames.clients);
    clientSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    clientSheet.getRange('A1:E1').setFontWeight('bold');
    clientSheet.setFrozenRows(1);
     // Add sample client
    clientSheet.appendRow([1, 'Cliente de Ejemplo S.A.S', 'ejemplo@correo.com', '3001234567', 'Calle Falsa 123']);
  }

  // Create Invoices sheet
  if (!ss.getSheetByName(sheetNames.invoices)) {
    const invoiceSheet = ss.insertSheet(sheetNames.invoices);
    invoiceSheet.appendRow(['InvoiceID', 'ClientID', 'ClientName', 'Date', 'DurationHours', 'HourlyRate', 'Total']);
    invoiceSheet.getRange('A1:G1').setFontWeight('bold');
    invoiceSheet.setFrozenRows(1);
  }

  // Create Users sheet
  if (!ss.getSheetByName(sheetNames.users)) {
    const userSheet = ss.insertSheet(sheetNames.users);
    userSheet.appendRow(['Username', 'PasswordHash', 'Salt']);
    userSheet.getRange('A1:C1').setFontWeight('bold');
    userSheet.setFrozenRows(1);
    // Add a default user for demonstration purposes
    const salt = generateSalt();
    const passwordHash = hashPassword('admin123', salt);
    userSheet.appendRow(['admin', passwordHash, salt]);
  }

  return 'Database tables created successfully!';
}

// =================================================================================================
//  AUTHENTICATION
// =================================================================================================

/**
 * @description Checks if the provided username and password match a record in the Users sheet.
 * @param {Object} data - Contains username and password.
 * @returns {Object} - An object with a 'success' boolean and a message.
 */
function checkLogin(data) {
  const { username, password } = data;
  const userSheet = ss.getSheetByName('Users');
  const users = sheetToJSON(userSheet);

  const user = users.find(u => u.Username === username);

  if (user) {
    const expectedHash = hashPassword(password, user.Salt);
    if (expectedHash === user.PasswordHash) {
      return { success: true, message: 'Login successful' };
    }
  }

  return { success: false, message: 'Invalid username or password' };
}


// =================================================================================================
//  CLIENT MANAGEMENT (CRUD)
// =================================================================================================

/**
 * @description Retrieves all clients from the "Clients" sheet.
 * @returns {Array<Object>} - An array of client objects.
 */
function getClients() {
  const clientSheet = ss.getSheetByName('Clients');
  return sheetToJSON(clientSheet);
}

/**
 * @description Adds a new client to the "Clients" sheet with a unique ID.
 * @param {Object} clientData - The new client's information.
 * @returns {Object} - The client data that was added, including the new ID.
 */
function addClient(clientData) {
  const clientSheet = ss.getSheetByName('Clients');
  const lastRow = clientSheet.getLastRow();
  // Generate a new ID by incrementing the last client's ID.
  const lastId = lastRow > 1 ? clientSheet.getRange(lastRow, 1).getValue() : 0;
  const newId = lastId + 1;

  clientSheet.appendRow([
    newId,
    clientData.name,
    clientData.email,
    clientData.phone,
    clientData.address
  ]);

  return { ...clientData, id: newId };
}

/**
 * @description Updates an existing client's information in the "Clients" sheet.
 * @param {Object} clientData - The client's updated information, including their ID.
 * @returns {Object} - The updated client data.
 */
function updateClient(clientData) {
  const clientSheet = ss.getSheetByName('Clients');
  const data = clientSheet.getDataRange().getValues();

  // Find the row index for the client with the matching ID
  const rowIndex = data.findIndex(row => row[0] == clientData.id);

  if (rowIndex > 0) { // rowIndex > 0 to avoid updating the header
    clientSheet.getRange(rowIndex + 1, 2).setValue(clientData.name);
    clientSheet.getRange(rowIndex + 1, 3).setValue(clientData.email);
    clientSheet.getRange(rowIndex + 1, 4).setValue(clientData.phone);
    clientSheet.getRange(rowIndex + 1, 5).setValue(clientData.address);
    return clientData;
  } else {
    throw new Error(`Client with ID ${clientData.id} not found.`);
  }
}

/**
 * @description Deletes a client from the "Clients" sheet based on their ID.
 * @param {number} id - The ID of the client to delete.
 * @returns {Object} - A confirmation object with the ID of the deleted client.
 */
function deleteClient(id) {
  const clientSheet = ss.getSheetByName('Clients');
  const data = clientSheet.getDataRange().getValues();

  // Find the row index for the client with the matching ID
  const rowIndex = data.findIndex(row => row[0] == id);

  if (rowIndex > 0) {
    clientSheet.deleteRow(rowIndex + 1);
    return { id: id };
  } else {
    throw new Error(`Client with ID ${id} not found.`);
  }
}

// =================================================================================================
//  INVOICE MANAGEMENT
// =================================================================================================

/**
 * @description Adds a new invoice record to the "Invoices" sheet.
 * @param {Object} invoiceData - The data for the new invoice.
 * @returns {Object} - The invoice data that was added.
 */
function addInvoice(invoiceData) {
  const invoiceSheet = ss.getSheetByName('Invoices');
  const lastRow = invoiceSheet.getLastRow();
  const lastId = lastRow > 1 ? invoiceSheet.getRange(lastRow, 1).getValue() : 0;
  const newId = lastId + 1;

  invoiceSheet.appendRow([
    newId,
    invoiceData.client.id,
    invoiceData.client.name,
    new Date(),
    invoiceData.hours,
    invoiceData.rate,
    invoiceData.total
  ]);

  return { ...invoiceData, invoiceId: newId };
}

// =================================================================================================
//  UTILITY FUNCTIONS
// =================================================================================================

/**
 * @description Converts a Google Sheet's data into an array of JSON objects.
 * Assumes the first row of the sheet is the header row.
 * @param {Sheet} sheet - The Google Sheet object to convert.
 * @returns {Array<Object>} - An array of objects representing the sheet data.
 */
function sheetToJSON(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      // For client ID, make sure it's an integer.
      obj[header] = (header.toLowerCase() === 'id' || header.toLowerCase() === 'clientid') ? parseInt(row[i], 10) : row[i];
    });
    return obj;
  });
}

/**
 * @description Generates a random salt for password hashing.
 * @returns {String} A random salt.
 */
function generateSalt() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * @description Hashes a password with a given salt using SHA-256.
 * @param {String} password The password to hash.
 * @param {String} salt The salt to use.
 * @returns {String} The hashed password.
 */
function hashPassword(password, salt) {
  const toHash = password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, toHash);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}
