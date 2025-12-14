// The URL of the Google Sheet, stored in Script Properties for security.
const SPREADSHEET_URL = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_URL');

/**
 * Handles HTTP GET requests.
 * @param {object} e - The event parameter.
 * @returns {ContentService.TextOutput} - The response.
 */
function doGet(e) {
  // Initial setup for GET requests.
  return ContentService.createTextOutput("Google Apps Script is running.");
}

/**
 * Handles HTTP POST requests.
 * This is the main endpoint for all data operations.
 * @param {object} e - The event parameter.
 * @returns {ContentService.TextOutput} - The response.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      case 'setup':
        return setup();
      case 'login':
        return login(data);
      case 'getClients':
        return getClients();
      case 'addClient':
        return addClient(data);
      case 'updateClient':
        return updateClient(data);
      case 'deleteClient':
        return deleteClient(data);
      case 'addInvoice':
        return addInvoice(data);
      default:
        return createJsonResponse({ status: 'error', message: 'Invalid action' });
    }
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.message });
  }
}

/**
 * Sets up the initial tables (sheets) in the Google Sheet.
 * Creates "Users", "Clients", and "Invoices" sheets.
 */
function setup() {
  const spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);

  // Create "Users" table
  const usersSheet = spreadsheet.getSheetByName("Users") || spreadsheet.insertSheet("Users");
  usersSheet.getRange("A1:B1").setValues([["Username", "Password"]]);
  if (usersSheet.getLastRow() < 2) {
    usersSheet.appendRow(["admin", "admin"]); // Add a default user
  }


  // Create "Clients" table
  const clientsSheet = spreadsheet.getSheetByName("Clients") || spreadsheet.insertSheet("Clients");
  clientsSheet.getRange("A1:E1").setValues([["ID", "Name", "Email", "Phone", "Address"]]);

  // Create "Invoices" table
  const invoicesSheet = spreadsheet.getSheetByName("Invoices") || spreadsheet.insertSheet("Invoices");
  invoicesSheet.getRange("A1:F1").setValues([["ID", "ClientID", "Date", "Duration", "Rate", "Total"]]);

  return createJsonResponse({ status: 'success', message: 'Tables created successfully' });
}

/**
 * Authenticates a user.
 * @param {object} data - The request data, containing username and password.
 * @returns {ContentService.TextOutput} - The JSON response.
 */
function login(data) {
  const { username, password } = data;
  const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName("Users");
  const users = sheet.getDataRange().getValues();

  for (let i = 1; i < users.length; i++) {
    if (users[i][0] === username && users[i][1] === password) {
      return createJsonResponse({ status: 'success', message: 'Login successful' });
    }
  }

  return createJsonResponse({ status: 'error', message: 'Invalid username or password' });
}

/**
 * Retrieves all clients from the "Clients" sheet.
 * @returns {ContentService.TextOutput} - The JSON response with the list of clients.
 */
function getClients() {
  const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName("Clients");
  const data = sheet.getDataRange().getValues();
  const clients = data.slice(1).map(row => ({
    id: row[0],
    name: row[1],
    email: row[2],
    phone: row[3],
    address: row[4]
  }));
  return createJsonResponse({ status: 'success', data: clients });
}

/**
 * Adds a new client to the "Clients" sheet.
 * @param {object} data - The client data.
 * @returns {ContentService.TextOutput} - The JSON response.
 */
function addClient(data) {
  const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName("Clients");
  const newId = generateUUID();
  const newRow = [newId, data.name, data.email, data.phone, data.address];
  sheet.appendRow(newRow);
  return createJsonResponse({ status: 'success', message: 'Client added successfully', data: { id: newId, ...data } });
}

/**
 * Updates an existing client in the "Clients" sheet.
 * @param {object} data - The client data to update.
 * @returns {ContentService.TextOutput} - The JSON response.
 */
function updateClient(data) {
  const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName("Clients");
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == data.id) {
      sheet.getRange(i + 1, 2, 1, 4).setValues([[data.name, data.email, data.phone, data.address]]);
      return createJsonResponse({ status: 'success', message: 'Client updated successfully' });
    }
  }

  return createJsonResponse({ status: 'error', message: 'Client not found' });
}

/**
 * Deletes a client from the "Clients" sheet.
 * @param {object} data - The request data, containing the client ID.
 * @returns {ContentService.TextOutput} - The JSON response.
 */
function deleteClient(data) {
  const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName("Clients");
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == data.id) {
      sheet.deleteRow(i + 1);
      return createJsonResponse({ status: 'success', message: 'Client deleted successfully' });
    }
  }

  return createJsonResponse({ status: 'error', message: 'Client not found' });
}

/**
 * Adds a new invoice to the "Invoices" sheet.
 * @param {object} data - The invoice data.
 * @returns {ContentService.TextOutput} - The JSON response.
 */
function addInvoice(data) {
  const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName("Invoices");
  const newId = generateUUID();
  const newRow = [newId, data.clientId, new Date(), data.hours, data.rate, data.total];
  sheet.appendRow(newRow);
  return createJsonResponse({ status: 'success', message: 'Invoice added successfully' });
}

/**
 * Generates a random UUID.
 * @returns {string} - The generated UUID.
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * A utility function to create a JSON response.
 * @param {object} data - The data to include in the response.
 * @returns {ContentService.TextOutput} - The JSON response.
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
