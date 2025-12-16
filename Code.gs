// ===============================================================
// TimeBill Pro - Google Apps Script Backend
// ===============================================================

// --- CONFIGURATION ---
// 1. SPREADSHEET_URL: The full URL of the Google Sheet you're using as a database.
//    - Create a new Google Sheet: https://sheets.new
//    - Copy its URL here.
// 2. GEMINI_API_KEY: Your API key for Google's Gemini API (for generating email drafts).
//    - Get your key from Google AI Studio: https://aistudio.google.com/app/apikey
//    - It's recommended to store this as a Script Property for security.
//      - In the Apps Script editor, go to "Project Settings" (gear icon).
//      - Under "Script Properties", add a property named 'GEMINI_API_KEY' and paste your key.

const SPREADSHEET_URL = ''; // <-- PASTE YOUR GOOGLE SHEET URL HERE

// --- GLOBAL VARIABLES ---
let spreadsheet;
let clientsSheet;
let usersSheet;
let invoicesSheet;

// Use a try-catch block to handle the case where the URL is not yet configured.
try {
    spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    clientsSheet = spreadsheet.getSheetByName('Clients');
    usersSheet = spreadsheet.getSheetByName('Users');
    invoicesSheet = spreadsheet.getSheetByName('Invoices');
} catch (e) {
    console.error("Spreadsheet URL might not be configured yet. Please configure it in Code.gs.");
}

const salt = "YOUR_STATIC_SALT_HERE"; // IMPORTANT: Change this to a unique, random string.

// ===============================================================
// Main API Entry Point
// ===============================================================

/**
 * Handles all POST requests from the frontend. Acts as a router.
 * @param {object} e - The event parameter from the POST request.
 * @returns {ContentService.TextOutput} - JSON response.
 */
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    let response;

    switch (action) {
      case 'setup':
        response = setup();
        break;
      case 'checkLogin':
        response = checkLogin(request.username, request.password);
        break;
      case 'getClients':
        response = getClients();
        break;
      case 'addClient':
        response = addClient(request.clientData);
        break;
      case 'updateClient':
        response = updateClient(request.clientData);
        break;
      case 'deleteClient':
        response = deleteClient(request.clientId);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: response }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('Error in doPost:', error);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===============================================================
// Setup and Initialization
// ===============================================================

/**
 * Sets up the required sheets in the spreadsheet.
 * Creates 'Clients', 'Users', and 'Invoices' sheets with headers.
 * Adds a default admin user.
 * @returns {string} - A confirmation message.
 */
function setup() {
  if (!SPREADSHEET_URL) {
      throw new Error("El SPREADSHEET_URL no está configurado en Code.gs. Por favor, añádelo para continuar.");
  }

  const sheetNames = ['Clients', 'Users', 'Invoices'];
  sheetNames.forEach(name => {
    if (!spreadsheet.getSheetByName(name)) {
      spreadsheet.insertSheet(name);
    }
  });

  // Set up headers for Clients sheet
  clientsSheet = spreadsheet.getSheetByName('Clients');
  const clientHeaders = ['ID', 'Name', 'Email', 'Phone', 'Address'];
  clientsSheet.getRange(1, 1, 1, clientHeaders.length).setValues([clientHeaders]);

  // Set up headers for Users sheet
  usersSheet = spreadsheet.getSheetByName('Users');
  const userHeaders = ['Username', 'PasswordHash'];
  usersSheet.getRange(1, 1, 1, userHeaders.length).setValues([userHeaders]);

  // Add a default admin user if one doesn't exist
  if (usersSheet.getLastRow() < 2) {
      const hashedPassword = hashPassword('admin', salt);
      usersSheet.appendRow(['admin', hashedPassword]);
  }

  // Set up headers for Invoices sheet
  invoicesSheet = spreadsheet.getSheetByName('Invoices');
  const invoiceHeaders = ['InvoiceID', 'ClientID', 'ClientName', 'Date', 'DurationHours', 'HourlyRate', 'TotalAmount'];
  invoicesSheet.getRange(1, 1, 1, invoiceHeaders.length).setValues([invoiceHeaders]);

  // Try to delete the default "Sheet1" if it exists
  const defaultSheet = spreadsheet.getSheetByName('Sheet1');
  if (defaultSheet) {
    spreadsheet.deleteSheet(defaultSheet);
  }

  return "Tablas 'Clients', 'Users' e 'Invoices' configuradas exitosamente.";
}

// ===============================================================
// User Authentication
// ===============================================================

/**
 * Creates a SHA-256 hash of the password with a salt.
 * @param {string} password - The user's password.
 * @param {string} salt - The static salt.
 * @returns {string} - The hashed password.
 */
function hashPassword(password, salt) {
    const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt);
    let txtHash = '';
    for (let i = 0; i < rawHash.length; i++) {
        let hashVal = rawHash[i];
        if (hashVal < 0) {
            hashVal += 256;
        }
        if (hashVal.toString(16).length == 1) {
            txtHash += '0';
        }
        txtHash += hashVal.toString(16);
    }
    return txtHash;
}

/**
 * Checks user credentials against the 'Users' sheet.
 * @param {string} username - The username to check.
 * @param {string} password - The password to check.
 * @returns {object} - An object with login status and a message.
 */
function checkLogin(username, password) {
  if (!usersSheet) throw new Error("La tabla 'Users' no existe. Por favor, ejecuta la configuración.");

  const hashedPassword = hashPassword(password, salt);
  const users = usersSheet.getDataRange().getValues();

  for (let i = 1; i < users.length; i++) {
    if (users[i][0] === username && users[i][1] === hashedPassword) {
      return { loggedIn: true, message: 'Login exitoso.' };
    }
  }

  return { loggedIn: false, message: 'Usuario o contraseña incorrectos.' };
}


// ===============================================================
// Client Management (CRUD)
// ===============================================================

/**
 * Retrieves all clients from the 'Clients' sheet.
 * @returns {Array<object>} - An array of client objects.
 */
function getClients() {
  if (!clientsSheet) throw new Error("La tabla 'Clients' no existe. Por favor, ejecuta la configuración.");

  const data = clientsSheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const clients = data.slice(1).map(row => {
    const client = {};
    headers.forEach((header, index) => {
      client[header.toLowerCase()] = row[index];
    });
    return client;
  });

  return clients;
}

/**
 * Adds a new client to the 'Clients' sheet.
 * Generates a unique ID for the new client.
 * @param {object} clientData - The data for the new client.
 * @returns {object} - The newly added client object.
 */
function addClient(clientData) {
  if (!clientsSheet) throw new Error("La tabla 'Clients' no existe. Por favor, ejecuta la configuración.");

  // Generate a new unique ID
  const lastRow = clientsSheet.getLastRow();
  const lastId = lastRow > 1 ? clientsSheet.getRange(lastRow, 1).getValue() : 0;
  const newId = lastId + 1;

  const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];
  clientsSheet.appendRow(newRow);

  return { ...clientData, id: newId };
}

/**
 * Updates an existing client in the 'Clients' sheet.
 * @param {object} clientData - The updated client data, including ID.
 * @returns {object} - The updated client object.
 */
function updateClient(clientData) {
  if (!clientsSheet) throw new Error("La tabla 'Clients' no existe. Por favor, ejecuta la configuración.");

  const data = clientsSheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('ID');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] == clientData.id) {
      const rowToUpdate = [clientData.id, clientData.name, clientData.email, clientData.phone, clientData.address];
      clientsSheet.getRange(i + 1, 1, 1, rowToUpdate.length).setValues([rowToUpdate]);
      return clientData;
    }
  }
  throw new Error(`Cliente con ID ${clientData.id} no encontrado.`);
}

/**
 * Deletes a client from the 'Clients' sheet.
 * @param {number} clientId - The ID of the client to delete.
 * @returns {object} - An object with the ID of the deleted client.
 */
function deleteClient(clientId) {
  if (!clientsSheet) throw new Error("La tabla 'Clients' no existe. Por favor, ejecuta la configuración.");

  const data = clientsSheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('ID');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] == clientId) {
      clientsSheet.deleteRow(i + 1);
      return { id: clientId };
    }
  }
  throw new Error(`Cliente con ID ${clientId} no encontrado.`);
}