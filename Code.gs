// Google Apps Script backend for TimeBill Pro

// --- CONFIGURATION ---
// To be set by the user in the script properties
// const SPREADSHEET_URL = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_URL');

// A simple utility for handling responses
function sendResponse(data, statusCode = 200) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setStatusCode(statusCode);
}

// --- MAIN API ROUTER ---
function doGet(e) {
  try {
    const action = e.parameter.action;

    // Ensure spreadsheet URL is set
    const SPREADSHEET_URL = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_URL');
    if (!SPREADSHEET_URL) {
      return sendResponse({ status: 'error', message: 'Spreadsheet URL not configured.' }, 400);
    }

    switch (action) {
      case 'getClients':
        return getClients();
      default:
        return sendResponse({ status: 'error', message: 'Invalid action' }, 400);
    }
  } catch (error) {
    return sendResponse({ status: 'error', message: error.message, stack: error.stack }, 500);
  }
}

function doPost(e) {
  try {
    const action = e.parameter.action;
    const data = JSON.parse(e.postData.contents);

    // Ensure spreadsheet URL is set, except for setup action
    const SPREADSHEET_URL = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_URL');
    if (!SPREADSHEET_URL && action !== 'setup') {
      return sendResponse({ status: 'error', message: 'Spreadsheet URL not configured.' }, 400);
    }

    switch (action) {
      case 'setup':
        return setup(data.spreadsheetUrl);
      case 'checkLogin':
        return checkLogin(data);
      case 'addUser':
        return addUser(data);
      case 'addClient':
        return addClient(data);
      case 'updateClient':
        return updateClient(data);
      case 'deleteClient':
        return deleteClient(data);
      case 'saveInvoice':
        return saveInvoice(data);
      default:
        return sendResponse({ status: 'error', message: 'Invalid action' }, 400);
    }
  } catch (error) {
    return sendResponse({ status: 'error', message: error.message, stack: error.stack }, 500);
  }
}

// --- SETUP FUNCTION ---
function setup(spreadsheetUrl) {
  try {
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_URL', spreadsheetUrl);
    const ss = SpreadsheetApp.openByUrl(spreadsheetUrl);

    const requiredSheets = ['Clients', 'Users', 'Invoices'];
    const existingSheets = ss.getSheets().map(s => s.getName());

    requiredSheets.forEach(sheetName => {
      if (!existingSheets.includes(sheetName)) {
        ss.insertSheet(sheetName);
        Utilities.sleep(500); // Small delay to ensure sheet is created
        const sheet = ss.getSheetByName(sheetName);
        if (sheetName === 'Clients') {
          sheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
        } else if (sheetName === 'Users') {
          sheet.appendRow(['Username', 'PasswordHash', 'Salt']);
        } else if (sheetName === 'Invoices') {
          sheet.appendRow(['InvoiceID', 'ClientID', 'Date', 'DurationHours', 'HourlyRate', 'TotalAmount']);
        }
      }
    });

    return sendResponse({ status: 'success', message: 'Tables created successfully!' });
  } catch (error) {
    return sendResponse({ status: 'error', message: `Setup failed: ${error.message}` }, 500);
  }
}

// --- USER AUTHENTICATION ---
function hashPassword(password, salt) {
  const saltedPassword = password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, saltedPassword);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

function checkLogin(data) {
  const { username, password } = data;
  const ss = SpreadsheetApp.openByUrl(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_URL'));
  const userSheet = ss.getSheetByName('Users');
  const users = userSheet.getDataRange().getValues();

  // Start from 1 to skip header row
  for (let i = 1; i < users.length; i++) {
    if (users[i][0] === username) {
      const storedHash = users[i][1];
      const salt = users[i][2];
      const passwordHash = hashPassword(password, salt);

      if (storedHash === passwordHash) {
        return sendResponse({ status: 'success', message: 'Login successful' });
      }
    }
  }
  return sendResponse({ status: 'error', message: 'Invalid username or password' }, 401);
}

function addUser(data) {
    const { username, password } = data;
    const ss = SpreadsheetApp.openByUrl(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_URL'));
    const userSheet = ss.getSheetByName('Users');

    // Check if user already exists
    const users = userSheet.getDataRange().getValues();
    for (let i = 1; i < users.length; i++) {
        if (users[i][0] === username) {
            return sendResponse({ status: 'error', message: 'User already exists' }, 409);
        }
    }

    const salt = Utilities.getUuid();
    const passwordHash = hashPassword(password, salt);
    userSheet.appendRow([username, passwordHash, salt]);

    return sendResponse({ status: 'success', message: 'User added successfully' });
}


// --- CLIENT MANAGEMENT (CRUD) ---
function getClients() {
  const ss = SpreadsheetApp.openByUrl(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_URL'));
  const clientSheet = ss.getSheetByName('Clients');
  const data = clientSheet.getDataRange().getValues();
  const headers = data.shift(); // Remove header row

  const clients = data.map(row => {
    let client = {};
    headers.forEach((header, index) => {
      client[header.toLowerCase()] = row[index];
    });
    return client;
  });

  return sendResponse({ status: 'success', data: clients });
}

function addClient(clientData) {
  const ss = SpreadsheetApp.openByUrl(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_URL'));
  const clientSheet = ss.getSheetByName('Clients');

  // Generate a unique ID
  const lastRow = clientSheet.getLastRow();
  const newId = lastRow > 0 ? clientSheet.getRange(lastRow, 1).getValue() + 1 : 1;

  clientSheet.appendRow([
    newId,
    clientData.name,
    clientData.email,
    clientData.phone,
    clientData.address
  ]);

  return sendResponse({ status: 'success', message: 'Client added', data: { ...clientData, id: newId } });
}

function updateClient(clientData) {
  const ss = SpreadsheetApp.openByUrl(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_URL'));
  const clientSheet = ss.getSheetByName('Clients');
  const data = clientSheet.getDataRange().getValues();

  const rowIndex = data.findIndex(row => row[0] == clientData.id);

  if (rowIndex === -1) {
    return sendResponse({ status: 'error', message: 'Client not found' }, 404);
  }

  // rowIndex is 0-based, but sheet rows are 1-based
  clientSheet.getRange(rowIndex + 1, 2).setValue(clientData.name);
  clientSheet.getRange(rowIndex + 1, 3).setValue(clientData.email);
  clientSheet.getRange(rowIndex + 1, 4).setValue(clientData.phone);
  clientSheet.getRange(rowIndex + 1, 5).setValue(clientData.address);

  return sendResponse({ status: 'success', message: 'Client updated' });
}

function deleteClient(data) {
  const { id } = data;
  const ss = SpreadsheetApp.openByUrl(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_URL'));
  const clientSheet = ss.getSheetByName('Clients');
  const sheetData = clientSheet.getDataRange().getValues();

  const rowIndex = sheetData.findIndex(row => row[0] == id);

  if (rowIndex === -1) {
    return sendResponse({ status: 'error', message: 'Client not found' }, 404);
  }

  // rowIndex is 0-based, but sheet rows are 1-based
  clientSheet.deleteRow(rowIndex + 1);

  return sendResponse({ status: 'success', message: 'Client deleted' });
}

// --- INVOICE MANAGEMENT ---
function saveInvoice(invoiceData) {
    const ss = SpreadsheetApp.openByUrl(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_URL'));
    const invoiceSheet = ss.getSheetByName('Invoices');

    const lastRow = invoiceSheet.getLastRow();
    const newId = lastRow > 0 ? invoiceSheet.getRange(lastRow, 1).getValue() + 1 : 1;

    invoiceSheet.appendRow([
        newId,
        invoiceData.clientId,
        invoiceData.date,
        invoiceData.hours,
        invoiceData.rate,
        invoiceData.total
    ]);

    return sendResponse({ status: 'success', message: 'Invoice saved' });
}
