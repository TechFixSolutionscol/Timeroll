
/**
 * @OnlyCurrentDoc
 *
 * The above comment directs App Script to limit the scope of file
 * access for this script to only the current document containing
 * the script.
 */

/**
 * Serves the HTML of the web application.
 *
 * @param {Object} e The event parameter for a web app request.
 * @return {HtmlOutput} The HTML output to be served.
 */
function doGet(e) {
  let template;
  if (checkAuth()) {
    template = HtmlService.createTemplateFromFile('index');
  } else {
    template = HtmlService.createTemplateFromFile('Login');
  }
  return template.evaluate()
      .setTitle('TimeBill Pro')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Includes the content of another HTML file.
 * This is a server-side include that helps keep the HTML organized.
 *
 * @param {string} filename The name of the file to include.
 * @return {string} The content of the included file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Adds a custom menu to the spreadsheet UI.
 * This function runs when the spreadsheet is opened.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('TimeBill Pro')
      .addItem('Setup Database', 'setupDatabase')
      .addToUi();
}

/**
 * Creates the Google Sheet database and sets up the required tables.
 * This function is intended to be run manually from the App Script editor menu.
 */
function setupDatabase() {
  const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
  const spreadsheetId = spreadsheet.getId();

  // Setup Clients sheet
  const clientsSheet = spreadsheet.getSheetByName('Sheet1');
  clientsSheet.setName('Clients');
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  clientsSheet.setFrozenRows(1);
  clientsSheet.getRange('A1:E1').setFontWeight('bold');

  // Setup Users sheet
  const usersSheet = spreadsheet.insertSheet('Users');
  usersSheet.appendRow(['ID', 'Username', 'PasswordHash', 'Role']);
  usersSheet.setFrozenRows(1);
  usersSheet.getRange('A1:D1').setFontWeight('bold');

  // Store the spreadsheet ID in script properties for later access
  PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

  // Add a default user for initial login
  const defaultPassword = 'password123';
  const hashedPassword = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, defaultPassword + '_static_salt')
                                  .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                                  .join('');
  usersSheet.appendRow([1, 'admin', hashedPassword, 'admin']);

  SpreadsheetApp.getUi().alert(`Database setup complete. The new spreadsheet ID is: ${spreadsheetId}. It has been stored in Script Properties.`);
}

/**
 * Helper function to get the spreadsheet object.
 * Throws an error if the database is not set up.
 *
 * @return {Spreadsheet} The spreadsheet object.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Database not set up. Please run "Setup Database" from the TimeBill Pro menu.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * SERVER-SIDE CRUD for Clients
 */

/**
 * Fetches all clients from the 'Clients' sheet.
 *
 * @return {Array<Object>} An array of client objects.
 */
function getClients() {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Remove header row
  return data.map(row => {
    const client = {};
    headers.forEach((header, i) => {
      client[header] = row[i];
    });
    return client;
  });
}

/**
 * Adds a new client to the 'Clients' sheet.
 *
 * @param {Object} clientData The client data to add.
 * @return {Array<Object>} The updated list of all clients.
 */
function addClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const allIds = sheet.getRange('A2:A').getValues().flat().filter(String);
  const maxId = allIds.length > 0 ? Math.max(...allIds) : 0;
  const newId = maxId + 1;

  const newRow = [newId, clientData.Name, clientData.Email, clientData.Phone, clientData.Address];
  sheet.appendRow(newRow);

  return getClients();
}

/**
 * Updates an existing client in the 'Clients' sheet.
 *
 * @param {Object} clientData The client data to update.
 * @return {Array<Object>} The updated list of all clients.
 */
function updateClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == clientData.ID);

  if (rowIndex === -1) {
    throw new Error('Client not found.');
  }

  const newRow = [clientData.ID, clientData.Name, clientData.Email, clientData.Phone, clientData.Address];
  // rowIndex + 1 because sheet ranges are 1-indexed
  sheet.getRange(rowIndex + 1, 1, 1, newRow.length).setValues([newRow]);

  return getClients();
}

/**
 * Deletes a client from the 'Clients' sheet.
 *
 * @param {number} clientId The ID of the client to delete.
 * @return {Array<Object>} The updated list of all clients.
 */
function deleteClient(clientId) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == clientId);

  if (rowIndex === -1) {
    throw new Error('Client not found.');
  }

  // rowIndex + 1 because sheet rows are 1-indexed
  sheet.deleteRow(rowIndex + 1);
  return getClients();
}

/**
 * SERVER-SIDE for Auth
 */

/**
 * Logs in a user by verifying their username and password.
 *
 * @param {string} username The user's username.
 * @param {string} password The user's password.
 * @return {Object} An object indicating success or failure.
 */
function login(username, password) {
  const usersSheet = getSpreadsheet().getSheetByName('Users');
  const data = usersSheet.getDataRange().getValues();
  const headers = data.shift();

  const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + '_static_salt')
                                .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                                .join('');

  const userRow = data.find(row => row[1] === username && row[2] === passwordHash);

  if (userRow) {
    const sessionToken = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Math.random().toString()));
    PropertiesService.getUserProperties().setProperty('sessionToken', sessionToken);
    return { success: true, user: { username: userRow[1], role: userRow[3] } };
  } else {
    return { success: false, message: 'Invalid username or password.' };
  }
}

/**
 * Checks if the user has a valid session.
 *
 * @return {boolean} True if the user is authenticated.
 */
function checkAuth() {
    return !!PropertiesService.getUserProperties().getProperty('sessionToken');
}

/**
 * Logs out the user by clearing their session.
 */
function logout() {
    PropertiesService.getUserProperties().deleteProperty('sessionToken');
}

/**
 * SERVER-SIDE for AI Features
 */

/**
 * Generates an email draft using the Gemini API.
 *
 * @param {string} prompt The prompt for the AI model.
 * @return {string} The generated email draft.
 */
function generateEmailDraftSafe(prompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
  if (!apiKey) {
    throw new Error('Gemini API key not set. Please set it in the Script Properties.');
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const result = JSON.parse(response.getContentText());

  if (result.candidates && result.candidates.length > 0 &&
      result.candidates[0].content && result.candidates[0].content.parts &&
      result.candidates[0].content.parts.length > 0) {
    return result.candidates[0].content.parts[0].text;
  } else {
    return 'No se pudo generar el borrador de correo. Inténtalo de nuevo.';
  }
}
