function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Creates a new Google Sheet to be used as the database and initializes it with the required tables.
 * This function is called from the client-side to set up the application's backend storage.
 */
function setupDatabase() {
  try {
    // Create a new spreadsheet and get its ID
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();

    // Store the spreadsheet ID in script properties for later access
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

    // Get the default sheet and rename it to 'Clients'
    const clientsSheet = spreadsheet.getSheets()[0];
    clientsSheet.setName('Clients');

    // Set the headers for the 'Clients' sheet
    const clientHeaders = ['ID', 'Name', 'Email', 'Phone', 'Address'];
    clientsSheet.getRange(1, 1, 1, clientHeaders.length).setValues([clientHeaders]);

    // Create a new sheet for 'Users'
    const usersSheet = spreadsheet.insertSheet('Users');

    // Set the headers for the 'Users' sheet
    const userHeaders = ['ID', 'Username', 'PasswordHash', 'Salt'];
    usersSheet.getRange(1, 1, 1, userHeaders.length).setValues([userHeaders]);

    // Create a default user for demonstration purposes
    const salt = Utilities.getUuid();
    const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'admin' + salt).map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');

    usersSheet.appendRow([Utilities.getUuid(), 'admin', passwordHash, salt]);

    return { success: true, message: 'Database created successfully!', spreadsheetId: spreadsheetId };
  } catch (error) {
    console.error('Error setting up database:', error);
    return { success: false, message: 'Error setting up database: ' + error.message };
  }
}

function getSheet(sheetName) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not found. Please set up the database first.');
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found.`);
  }
  return sheet;
}

function getClients() {
  const sheet = getSheet('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    const client = {};
    headers.forEach((header, i) => {
      client[header] = row[i];
    });
    return client;
  });
}

function addClient(clientData) {
  const sheet = getSheet('Clients');
  const newId = Utilities.getUuid();
  sheet.appendRow([newId, clientData.Name, clientData.Email, clientData.Phone, clientData.Address]);
  return { ID: newId, ...clientData };
}

function updateClient(clientData) {
  const sheet = getSheet('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('ID');
  const rowIndex = data.findIndex(row => row[idIndex] === clientData.ID);

  if (rowIndex > 0) {
    const row = headers.map(header => clientData[header] || '');
    sheet.getRange(rowIndex + 1, 1, 1, row.length).setValues([row]);
    return clientData;
  }
  throw new Error('Client not found');
}

function deleteClient(id) {
  const sheet = getSheet('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('ID');
  const rowIndex = data.findIndex(row => row[idIndex] === id);

  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex + 1);
    return { id };
  }
  throw new Error('Client not found');
}

function loginUser(username, password) {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const usernameIndex = headers.indexOf('Username');
  const passwordHashIndex = headers.indexOf('PasswordHash');
  const saltIndex = headers.indexOf('Salt');

  const user = data.find(row => row[usernameIndex] === username);

  if (user) {
    const salt = user[saltIndex];
    const storedHash = user[passwordHashIndex];
    const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt).map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
    if (passwordHash === storedHash) {
      return { success: true, username };
    }
  }
  return { success: false, message: 'Invalid username or password' };
}
