const SCRIPT_PROPERTY_KEY = 'spreadsheetId';

// --- Utility Functions ---
function getSpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty(SCRIPT_PROPERTY_KEY);
  if (!spreadsheetId) return null;
  return SpreadsheetApp.openById(spreadsheetId);
}

function hashPassword(password, salt) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt);
  return Utilities.base64Encode(digest);
}

function isAuthenticated() {
    const userId = PropertiesService.getUserProperties().getProperty('userId');
    return !!userId;
}

// --- Main App Functions ---
function doGet(e) {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty(SCRIPT_PROPERTY_KEY);

  let template = HtmlService.createTemplateFromFile('index');
  template.isInitialized = !!spreadsheetId;

  return template.evaluate()
    .setTitle('TimeBill Pro')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setup() {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(SCRIPT_PROPERTY_KEY)) {
    return { success: false, message: 'Database already initialized.' };
  }

  try {
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();
    properties.setProperty(SCRIPT_PROPERTY_KEY, spreadsheetId);

    const usersSheet = spreadsheet.getSheets()[0];
    usersSheet.setName('Users');
    usersSheet.appendRow(['ID', 'Name', 'Email', 'HashedPassword', 'Salt']);
    usersSheet.setFrozenRows(1);

    const clientsSheet = spreadsheet.insertSheet('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address', 'OwnerId']);
    clientsSheet.setFrozenRows(1);

    return { success: true, message: 'Database setup complete!' };
  } catch (e) {
    return { success: false, message: 'An error occurred: ' + e.message };
  }
}

// --- Authentication Functions ---
function registerUser(name, email, password) {
  const ss = getSpreadsheet();
  if (!ss) return { success: false, message: "Database not found." };
  const usersSheet = ss.getSheetByName('Users');

  const users = usersSheet.getDataRange().getValues();
  for (let i = 1; i < users.length; i++) {
    if (users[i][2] === email) {
      return { success: false, message: 'A user with this email already exists.' };
    }
  }

  const userId = Utilities.getUuid();
  const salt = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Math.random().toString()));
  const hashedPassword = hashPassword(password, salt);

  usersSheet.appendRow([userId, name, email, hashedPassword, salt]);

  return { success: true, message: 'User registered successfully!' };
}

function loginUser(email, password) {
  const ss = getSpreadsheet();
  if (!ss) return { success: false, message: "Database not found." };
  const usersSheet = ss.getSheetByName('Users');

  const users = usersSheet.getDataRange().getValues();
  for (let i = 1; i < users.length; i++) {
    if (users[i][2] === email) {
      const storedHash = users[i][3];
      const salt = users[i][4];
      const inputHash = hashPassword(password, salt);

      if (inputHash === storedHash) {
        PropertiesService.getUserProperties().setProperty('userId', users[i][0]);
        return { success: true, user: { id: users[i][0], name: users[i][1], email: users[i][2] } };
      } else {
        return { success: false, message: 'Invalid password.' };
      }
    }
  }
  return { success: false, message: 'User not found.' };
}

function checkAuth() {
    const userId = PropertiesService.getUserProperties().getProperty('userId');
    if (!userId) return { isAuthenticated: false };

    const ss = getSpreadsheet();
    if (!ss) return { isAuthenticated: false, message: "Database not found." };
    const usersSheet = ss.getSheetByName('Users');
    const users = usersSheet.getDataRange().getValues();

    for (let i = 1; i < users.length; i++) {
        if (users[i][0] === userId) {
            return { isAuthenticated: true, user: { id: users[i][0], name: users[i][1], email: users[i][2] } };
        }
    }
    return { isAuthenticated: false };
}

function logout() {
  PropertiesService.getUserProperties().deleteProperty('userId');
  return { success: true };
}

// --- Client Management Functions ---
function getClients() {
    if (!isAuthenticated()) throw new Error("Not authenticated.");
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const clients = [];
    const userId = PropertiesService.getUserProperties().getProperty('userId');

    for (let i = 1; i < data.length; i++) {
        if (data[i][5] === userId) { // Check OwnerId
            clients.push({
                id: data[i][0],
                name: data[i][1],
                email: data[i][2],
                phone: data[i][3],
                address: data[i][4]
            });
        }
    }
    return clients;
}

function addClient(clientData) {
    if (!isAuthenticated()) throw new Error("Not authenticated.");
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Clients');
    const id = Utilities.getUuid();
    const userId = PropertiesService.getUserProperties().getProperty('userId');
    sheet.appendRow([id, clientData.name, clientData.email, clientData.phone, clientData.address, userId]);
    return { id, ...clientData };
}

function updateClient(clientData) {
    if (!isAuthenticated()) throw new Error("Not authenticated.");
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const userId = PropertiesService.getUserProperties().getProperty('userId');

    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === clientData.id && data[i][5] === userId) {
            sheet.getRange(i + 1, 2, 1, 4).setValues([[clientData.name, clientData.email, clientData.phone, clientData.address]]);
            return clientData;
        }
    }
    throw new Error("Client not found or you don't have permission to edit.");
}

function deleteClient(clientId) {
    if (!isAuthenticated()) throw new Error("Not authenticated.");
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const userId = PropertiesService.getUserProperties().getProperty('userId');

    for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][0] === clientId && data[i][5] === userId) {
            sheet.deleteRow(i + 1);
            return { success: true };
        }
    }
    throw new Error("Client not found or you don't have permission to delete.");
}