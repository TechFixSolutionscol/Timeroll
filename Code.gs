// This file will contain all the backend logic for the Google Apps Script.

function doGet(e) {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- Database Setup ---
function setupDatabase() {
  try {
    const sheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = sheet.getId();
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

    // Setup Clients Sheet
    const clientsSheet = sheet.getSheets()[0];
    clientsSheet.setName('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    clientsSheet.setFrozenRows(1);

    // Setup Users Sheet
    const usersSheet = sheet.insertSheet('Users');
    usersSheet.appendRow(['ID', 'Username', 'PasswordHash', 'Salt']);
    usersSheet.setFrozenRows(1);

    // Add a default admin user
    const salt = generateSalt_();
    const passwordHash = hashPassword_('admin123', salt);
    usersSheet.appendRow([Utilities.getUuid(), 'admin', passwordHash, salt]);

    return { success: true, message: 'Database created successfully! Spreadsheet ID: ' + spreadsheetId };
  } catch (error) {
    return { success: false, message: 'Error setting up database: ' + error.message };
  }
}

// --- Utility Functions ---
function getDb_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not found. Please run the database setup.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function generateSalt_() {
  const randomBytes = [];
  for (let i = 0; i < 16; i++) {
    randomBytes.push(Math.floor(Math.random() * 256));
  }
  return Utilities.base64Encode(randomBytes);
}

function hashPassword_(password, salt) {
  const saltBytes = Utilities.base64Decode(salt);
  const passwordBytes = Utilities.newBlob(password).getBytes();
  const combined = saltBytes.concat(passwordBytes);
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, combined);
  return Utilities.base64Encode(hash);
}

// --- User Authentication ---
function login(username, password) {
  try {
    const usersSheet = getDb_().getSheetByName('Users');
    const data = usersSheet.getDataRange().getValues();
    // Start from 1 to skip header row
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === username) {
        const salt = data[i][3];
        const correctHash = data[i][2];
        const hashToTest = hashPassword_(password, salt);
        if (hashToTest === correctHash) {
          return { success: true, user: { id: data[i][0], username: data[i][1] } };
        }
      }
    }
    return { success: false, message: 'Invalid username or password.' };
  } catch (error) {
    return { success: false, message: 'Login error: ' + error.message };
  }
}

// --- Client Management (CRUD) ---
function getClients() {
  const clientsSheet = getDb_().getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  data.shift(); // Remove header row
  return data.map(row => ({
    id: row[0],
    name: row[1],
    email: row[2],
    phone: row[3],
    address: row[4]
  }));
}

function addClient(clientData) {
  try {
    const clientsSheet = getDb_().getSheetByName('Clients');
    const newId = Utilities.getUuid();
    clientsSheet.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
    return { success: true, id: newId };
  } catch (error) {
    return { success: false, message: 'Error adding client: ' + error.message };
  }
}

function updateClient(clientData) {
  try {
    const clientsSheet = getDb_().getSheetByName('Clients');
    const data = clientsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === clientData.id) {
        clientsSheet.getRange(i + 1, 2, 1, 4).setValues([[clientData.name, clientData.email, clientData.phone, clientData.address]]);
        return { success: true };
      }
    }
    return { success: false, message: 'Client not found.' };
  } catch (error) {
    return { success: false, message: 'Error updating client: ' + error.message };
  }
}

function deleteClient(id) {
  try {
    const clientsSheet = getDb_().getSheetByName('Clients');
    const data = clientsSheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === id) {
        clientsSheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, message: 'Client not found.' };
  } catch (error) {
    return { success: false, message: 'Error deleting client: ' + error.message };
  }
}
