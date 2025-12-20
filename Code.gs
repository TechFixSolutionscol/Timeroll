function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setup() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = sheet.getSheets().map(s => s.getName());

  if (sheetNames.indexOf('Users') === -1) {
    const userSheet = sheet.insertSheet('Users');
    userSheet.appendRow(['ID', 'Email', 'PasswordHash', 'Salt']);
    createNewUser('admin@example.com', 'password123');
  }

  if (sheetNames.indexOf('Clients') === -1) {
    const clientSheet = sheet.insertSheet('Clients');
    clientSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  }

  if (sheetNames.indexOf('Invoices') === -1) {
    const invoiceSheet = sheet.insertSheet('Invoices');
    invoiceSheet.appendRow(['ID', 'ClientID', 'Date', 'Hours', 'Rate', 'Total']);
  }

  return 'Setup complete. Sheets created: Users, Clients, Invoices.';
}

function getNewId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 1;
  }
  const range = sheet.getRange(2, 1, lastRow - 1, 1);
  const ids = range.getValues().flat();
  const maxId = Math.max(...ids);
  return maxId + 1;
}

function hashPassword(password, salt) {
  const toHash = password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, toHash);
  return Utilities.base64Encode(hash);
}

function verifyPassword(password, salt, storedHash) {
  const newHash = hashPassword(password, salt);
  return newHash === storedHash;
}

function createNewUser(email, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const salt = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Math.random().toString()));
  const hash = hashPassword(password, salt);
  const newId = getNewId(sheet);
  sheet.appendRow([newId, email, hash, salt]);
  return { success: true, message: 'User created' };
}

function login(email, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  data.shift();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row[1] === email) {
      const storedHash = row[2];
      const salt = row[3];
      if (verifyPassword(password, salt, storedHash)) {
        return { success: true, message: 'Login successful' };
      }
    }
  }

  return { success: false, message: 'Invalid credentials' };
}

function getClients() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.map(row => ({
    id: row[0],
    name: row[1],
    email: row[2],
    phone: row[3],
    address: row[4]
  }));
}

function addClient(clientData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Clients');
  const newId = getNewId(sheet);
  sheet.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
  return { success: true, message: 'Client added', id: newId };
}

function updateClient(clientData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == clientData.id) {
      sheet.getRange(i + 1, 2).setValue(clientData.name);
      sheet.getRange(i + 1, 3).setValue(clientData.email);
      sheet.getRange(i + 1, 4).setValue(clientData.phone);
      sheet.getRange(i + 1, 5).setValue(clientData.address);
      return { success: true, message: 'Client updated' };
    }
  }
  return { success: false, message: 'Client not found' };
}

function deleteClient(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Client deleted' };
    }
  }
  return { success: false, message: 'Client not found' };
}
