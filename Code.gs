/**
 * @OnlyCurrentDoc
 */

// --- GLOBAL CONFIGURATION ---
const SPREADSHEET_ID_KEY = 'spreadsheetId';

// --- SERVER-SIDE ENTRY POINT ---

/**
 * Serves the main HTML page of the web application.
 * This function is automatically called when a user visits the script's URL.
 */
function doGet() {
  const html = HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('TimeBill Pro')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  return html;
}

/**
 * Includes HTML content from another file into the main template.
 * This allows for modular HTML (partials like styles, scripts).
 * @param {string} filename The name of the file to include.
 * @return {string} The content of the specified HTML file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- DATABASE SETUP ---

/**
 * Creates the initial Google Sheet database with required sheets and headers.
 * This function must be run manually from the Apps Script editor the first time.
 */
function setupDatabase() {
  const spreadsheet = SpreadsheetApp.create('TimeBill Pro - Database');
  const spreadsheetId = spreadsheet.getId();

  // Store the ID for future access
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, spreadsheetId);

  // Setup "Clients" sheet
  const clientsSheet = spreadsheet.getSheets()[0];
  clientsSheet.setName('Clients');
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  clientsSheet.setFrozenRows(1);

  // Setup "Users" sheet (for future expansion)
  const usersSheet = spreadsheet.insertSheet('Users');
  usersSheet.appendRow(['ID', 'Name', 'Email', 'Role']);
  usersSheet.setFrozenRows(1);

  // Log the URL for the user to see
  console.log(`Database created. You can access it at: ${spreadsheet.getUrl()}`);

  // Display a confirmation message to the user running the script
  SpreadsheetApp.getUi().alert('Database setup complete!');
}

// --- DATABASE HELPER ---

/**
 * Retrieves the Google Sheet object for the database.
 * Throws an error if the database has not been set up.
 * @return {SpreadsheetApp.Spreadsheet} The spreadsheet object.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!spreadsheetId) {
    throw new Error('Database not set up. Please run the "setupDatabase" function from the script editor.');
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  if (!spreadsheet) {
    throw new Error(`Could not open spreadsheet with ID: ${spreadsheetId}`);
  }
  return spreadsheet;
}

// --- API: CLIENTS ---

/**
 * Fetches all clients from the "Clients" sheet.
 * @return {Array<Object>} An array of client objects.
 */
function getClients() {
  try {
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
  } catch (e) {
    console.error(`Error in getClients: ${e.message}`);
    throw new Error(`Failed to retrieve clients. Details: ${e.message}`);
  }
}

/**
 * Adds a new client to the "Clients" sheet.
 * Generates a new unique ID for the client.
 * @param {Object} clientData An object containing the client's information.
 * @return {Object} The newly added client object with its ID.
 */
function addClient(clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');

    // Generate a new ID (simple increment)
    const idColumn = sheet.getRange("A2:A").getValues().filter(String);
    const maxId = idColumn.length > 0 ? Math.max(...idColumn) : 0;
    const newId = maxId + 1;

    const newRow = [
      newId,
      clientData.Name,
      clientData.Email,
      clientData.Phone,
      clientData.Address
    ];

    sheet.appendRow(newRow);

    return { ...clientData, ID: newId };
  } catch (e) {
    console.error(`Error in addClient: ${e.message}`);
    throw new Error(`Failed to add client. Details: ${e.message}`);
  }
}

/**
 * Updates an existing client's information in the "Clients" sheet.
 * @param {Object} clientData An object containing the client's updated information, including ID.
 * @return {Object} The updated client object.
 */
function updateClient(clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Find row index for the given client ID
    const rowIndex = data.findIndex(row => row[0] == clientData.ID);

    if (rowIndex === -1) {
      throw new Error(`Client with ID ${clientData.ID} not found.`);
    }

    // Create the updated row array based on header order
    const updatedRow = headers.map(header => clientData[header] || '');

    // Update the specific row in the sheet (+1 because sheets are 1-indexed)
    sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([updatedRow]);

    return clientData;
  } catch (e) {
    console.error(`Error in updateClient: ${e.message}`);
    throw new Error(`Failed to update client. Details: ${e.message}`);
  }
}

/**
 * Deletes a client from the "Clients" sheet based on their ID.
 * @param {number} clientId The ID of the client to delete.
 * @return {string} A confirmation message.
 */
function deleteClient(clientId) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();

    // Find the row index for the client ID
    const rowIndex = data.findIndex(row => row[0] == clientId);

    if (rowIndex === -1) {
      throw new Error(`Client with ID ${clientId} not found.`);
    }

    // Delete the row (+1 because sheets are 1-indexed)
    sheet.deleteRow(rowIndex + 1);

    return `Client with ID ${clientId} deleted successfully.`;
  } catch (e) {
    console.error(`Error in deleteClient: ${e.message}`);
    throw new Error(`Failed to delete client. Details: ${e.message}`);
  }
}

// --- API: GEMINI ---

/**
 * Generates an email draft using the Gemini API.
 * The API key must be stored in Script Properties.
 * @param {string} prompt The prompt to send to the Gemini API.
 * @return {string} The generated text content from the API.
 */
function generateEmailDraft(prompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
  if (!apiKey) {
    throw new Error('Gemini API key not found. Please set it in the Script Properties.');
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

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      return result.candidates[0].content.parts[0].text;
    } else {
      // Log the full result for debugging if the structure is unexpected
      console.log('Unexpected API response structure:', JSON.stringify(result, null, 2));
      throw new Error('Could not extract content from Gemini API response.');
    }
  } catch (e) {
    console.error(`Error calling Gemini API: ${e.toString()}`);
    console.error(`API Response: ${e.message}`);
    throw new Error(`Failed to generate email draft. Details: ${e.message}`);
  }
}
