const SCRIPT_PROP = PropertiesService.getScriptProperties(); // Allows saving script properties

/**
 * Serves the HTML of the web application.
 * This function is automatically called when the web app URL is visited.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Includes the content of another HTML file.
 * This is a helper function used in the main HTML file to include CSS and JS.
 * @param {string} filename - The name of the file to include.
 * @return {string} The content of the included file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * =================================================================
 * DATABASE SETUP AND HELPER FUNCTIONS
 * =================================================================
 */

/**
 * Creates the Google Sheet database and sets it up with initial tables and data.
 * This function is intended to be run once by the user.
 * @return {string} A confirmation message.
 */
function setupDatabase() {
  try {
    // 1. Create a new Google Spreadsheet
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();

    // 2. Save the spreadsheet ID in script properties for future access
    SCRIPT_PROP.setProperty('spreadsheetId', spreadsheetId);

    // 3. Get the default sheet and rename it to 'Users'
    const userSheet = spreadsheet.getSheets()[0];
    userSheet.setName('Users');

    // 4. Set up the 'Users' table headers with secure password storage in mind
    const userHeaders = ['userId', 'email', 'passwordHash', 'salt', 'role'];
    userSheet.appendRow(userHeaders);
    userSheet.setFrozenRows(1);

    // 5. Add a default admin user with a hashed password
    const adminUserId = Utilities.getUuid();
    const adminPassword = 'admin';
    const salt = Utilities.getUuid(); // Generate a unique salt for the user
    const passwordHash = hashPassword_(adminPassword, salt);
    const adminUser = [adminUserId, 'admin@example.com', passwordHash, salt, 'admin'];
    userSheet.appendRow(adminUser);

    // 6. Create the 'Clients' table
    const clientSheet = spreadsheet.insertSheet('Clients');
    const clientHeaders = ['clientId', 'name', 'email', 'phone', 'address'];
    clientSheet.appendRow(clientHeaders);
    clientSheet.setFrozenRows(1);

    // 7. Log the URL for the user to see and return a success message
    const url = spreadsheet.getUrl();
    console.log(`Database setup complete. Access it here: ${url}`);
    return `Database setup successfully! Your data is stored here: ${url}`;
  } catch (e) {
    console.error(`Error during database setup: ${e.toString()}`);
    throw new Error(`Failed to set up the database. Error: ${e.toString()}`);
  }
}

/**
 * Helper function to get the active spreadsheet using the stored ID.
 * @returns {Spreadsheet} The Google Spreadsheet object.
 */
function getSpreadsheet() {
  const spreadsheetId = SCRIPT_PROP.getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not found. Please run the setupDatabase function first.');
  }
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (e) {
    throw new Error('Could not open the spreadsheet. Please check if the ID is correct and you have access.');
  }
}

/**
 * Helper function to get a specific sheet by name from the active spreadsheet.
 * @param {string} sheetName - The name of the sheet to retrieve.
 * @returns {Sheet} The Google Sheet object.
 */
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in the spreadsheet.`);
  }
  return sheet;
}

/**
 * =================================================================
 * SERVER-SIDE FUNCTIONS FOR THE WEB APP
 * =================================================================
 */

/**
 * Logs in a user.
 * For this demo, it's a simple check against hardcoded values.
 * In a real app, you'd check against the 'Users' sheet.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {object} User object if successful, or error message.
 */
function login(email, password) {
  try {
    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const emailIndex = headers.indexOf('email');
    const hashIndex = headers.indexOf('passwordHash');
    const saltIndex = headers.indexOf('salt');
    const roleIndex = headers.indexOf('role');

    const userRow = data.find(row => row[emailIndex].toLowerCase() === email.toLowerCase());

    if (!userRow) {
      return { success: false, message: 'Usuario o contraseña incorrectos.' };
    }

    const storedHash = userRow[hashIndex];
    const salt = userRow[saltIndex];
    const providedHash = hashPassword_(password, salt);

    if (providedHash === storedHash) {
      return {
        success: true,
        user: { email: userRow[emailIndex], role: userRow[roleIndex] }
      };
    } else {
      return { success: false, message: 'Usuario o contraseña incorrectos.' };
    }
  } catch (e) {
    console.error(`Error in login: ${e.toString()}`);
    return { success: false, message: `Ocurrió un error: ${e.message}` };
  }
}

/**
 * Hashes a password with a given salt using SHA-256.
 * @param {string} password - The plaintext password.
 * @param {string} salt - The salt value.
 * @returns {string} The hashed password as a hex string.
 */
function hashPassword_(password, salt) {
  const toHash = password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, toHash);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Retrieves all clients from the 'Clients' sheet.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
  try {
    const sheet = getSheet('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header row

    return data.map(row => {
      const client = {};
      headers.forEach((header, i) => {
        client[header] = row[i];
      });
      return client;
    });
  } catch (e) {
    console.error(`Error in getClients: ${e.toString()}`);
    return []; // Return empty array on error
  }
}

/**
 * Adds a new client to the 'Clients' sheet.
 * @param {object} clientData - The client's data.
 * @returns {object} The newly added client object.
 */
function addClient(clientData) {
  try {
    const sheet = getSheet('Clients');
    const newId = Utilities.getUuid();
    const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];
    sheet.appendRow(newRow);

    return { clientId: newId, ...clientData };
  } catch (e) {
    console.error(`Error in addClient: ${e.toString()}`);
    throw new Error(`Failed to add client. Error: ${e.toString()}`);
  }
}

/**
 * Updates an existing client's information in the 'Clients' sheet.
 * @param {object} clientData - The client's updated data, including clientId.
 * @returns {object} The updated client object.
 */
function updateClient(clientData) {
  try {
    const sheet = getSheet('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const clientIdIndex = headers.indexOf('clientId');

    const rowIndex = data.findIndex(row => row[clientIdIndex] === clientData.clientId);

    if (rowIndex === -1) {
      throw new Error('Client not found.');
    }

    const newRow = headers.map(header => clientData[header] || '');
    sheet.getRange(rowIndex + 1, 1, 1, newRow.length).setValues([newRow]);

    return clientData;
  } catch (e) {
    console.error(`Error in updateClient: ${e.toString()}`);
    throw new Error(`Failed to update client. Error: ${e.toString()}`);
  }
}

/**
 * Deletes a client from the 'Clients' sheet.
 * @param {string} clientId - The ID of the client to delete.
 * @returns {object} A success message.
 */
function deleteClient(clientId) {
  try {
    const sheet = getSheet('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const clientIdIndex = headers.indexOf('clientId');

    const rowIndex = data.findIndex(row => row[clientIdIndex] === clientId);

    if (rowIndex === -1) {
      throw new Error('Client not found.');
    }

    sheet.deleteRow(rowIndex + 1);

    return { success: true, message: 'Client deleted successfully.' };
  } catch (e) {
    console.error(`Error in deleteClient: ${e.toString()}`);
    throw new Error(`Failed to delete client. Error: ${e.toString()}`);
  }
}

/**
 * =================================================================
 * API AND EXTERNAL SERVICES
 * =================================================================
 */

/**
 * Saves the Gemini API key to Script Properties.
 * @param {string} apiKey - The Gemini API key.
 * @returns {void}
 */
function setGeminiApiKey(apiKey) {
  SCRIPT_PROP.setProperty('geminiApiKey', apiKey);
}

/**
 * Generates an email draft using the Gemini API.
 * The function is marked with a trailing underscore to indicate it's not meant to be called directly from the client-side `google.script.run` for security.
 * @param {string} prompt - The prompt to send to the Gemini API.
 * @returns {string} The generated email draft.
 */
function generateEmailDraft_(prompt) {
  const apiKey = SCRIPT_PROP.getProperty('geminiApiKey');
  if (!apiKey) {
    return 'Error: Gemini API key is not set. Please set it in the script properties.';
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

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

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates[0] && result.candidates[0].content.parts && result.candidates[0].content.parts[0].text) {
      return result.candidates[0].content.parts[0].text;
    } else {
      console.error('Unexpected Gemini API response format:', JSON.stringify(result, null, 2));
      return 'Error: Could not parse the response from Gemini API.';
    }
  } catch (e) {
    console.error(`Error calling Gemini API: ${e.toString()}`);
    return `Error generating draft: ${e.toString()}`;
  }
}
