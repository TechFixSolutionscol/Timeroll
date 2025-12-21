const SHEET_NAMES = {
  USERS: 'Users',
  CLIENTS: 'Clients',
  INVOICES: 'Invoices'
};

/**
 * Serves the web application.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate();
}

/**
 * Includes an external file's content in the HTML template.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Sets up the spreadsheet with the required sheets and headers.
 */
function setup() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheetNames = Object.values(SHEET_NAMES);

    sheetNames.forEach(sheetName => {
      if (!spreadsheet.getSheetByName(sheetName)) {
        spreadsheet.insertSheet(sheetName);
      }
    });

    const usersSheet = spreadsheet.getSheetByName(SHEET_NAMES.USERS);
    if (usersSheet.getLastRow() === 0) {
      usersSheet.appendRow(['ID', 'Name', 'Email', 'PasswordHash']);
      const defaultPasswordHash = hashPassword('admin123');
      usersSheet.appendRow([1, 'Admin User', 'admin@example.com', defaultPasswordHash]);
    }

    const clientsSheet = spreadsheet.getSheetByName(SHEET_NAMES.CLIENTS);
    if (clientsSheet.getLastRow() === 0) {
      clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    }

    const invoicesSheet = spreadsheet.getSheetByName(SHEET_NAMES.INVOICES);
    if (invoicesSheet.getLastRow() === 0) {
      invoicesSheet.appendRow(['ID', 'ClientID', 'DateTime', 'DurationHours', 'HourlyRate', 'TotalAmount']);
    }

    return { success: true, message: 'Spreadsheet setup complete. Default user created (admin@example.com / admin123).' };
  } catch (error) {
    return { success: false, message: `An error occurred during setup: ${error.message}` };
  }
}

/**
 * Hashes a password using SHA-256.
 */
function hashPassword(password) {
    const hashedPassword = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
    return hashedPassword.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Authenticates a user.
 */
function login(email, password) {
  const usersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
  const data = usersSheet.getDataRange().getValues();
  const passwordHash = hashPassword(password);

  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === email && data[i][3] === passwordHash) {
      return { success: true, user: { id: data[i][0], name: data[i][1], email: data[i][2] } };
    }
  }
  return { success: false, message: 'Invalid email or password.' };
}

/**
 * Gets the next available ID for a new record.
 */
function getNextId(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
        return 1;
    }
    const maxId = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
        .reduce((max, row) => Math.max(max, row[0]), 0);
    return maxId + 1;
}

/**
 * Retrieves all clients.
 */
function getClients() {
  const clientsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.CLIENTS);
  const data = clientsSheet.getDataRange().getValues();
  data.shift(); // Remove header row
  return data.map(row => ({ id: row[0], name: row[1], email: row[2], phone: row[3], address: row[4] }));
}

/**
 * Adds a new client.
 */
function addClient(clientData) {
  const clientsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.CLIENTS);
  const newId = getNextId(clientsSheet);
  clientsSheet.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
  return { id: newId, ...clientData };
}

/**
 * Updates an existing client.
 */
function updateClient(clientData) {
  const clientsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.CLIENTS);
  const data = clientsSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == clientData.id) {
      clientsSheet.getRange(i + 1, 2, 1, 4).setValues([[clientData.name, clientData.email, clientData.phone, clientData.address]]);
      return clientData;
    }
  }
  throw new Error('Client not found.');
}

/**
 * Deletes a client.
 */
function deleteClient(clientId) {
  const clientsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.CLIENTS);
  const data = clientsSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == clientId) {
      clientsSheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('Client not found.');
}

/**
 * Saves a new invoice.
 */
function saveInvoice(invoiceData) {
    const invoicesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.INVOICES);
    const newId = getNextId(invoicesSheet);
    invoicesSheet.appendRow([
        newId,
        invoiceData.clientId,
        new Date(),
        invoiceData.durationHours,
        invoiceData.hourlyRate,
        invoiceData.totalAmount
    ]);
    return { id: newId, ...invoiceData };
}
