// The property key for the spreadsheet ID
const SPREADSHEET_ID_KEY = 'spreadsheetId';

/**
 * Serves the main HTML page of the web application.
 * This function is automatically called when a user visits the script's URL.
 *
 * @param {Object} e The event parameter for a web app doGet request.
 * @returns {HtmlOutput} The HTML service output for the web page.
 */
function doGet(e) {
  const html = HtmlService.createTemplateFromFile('index').evaluate();
  html.setTitle('TimeBill Pro');
  html.addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  return html;
}

/**
 * Includes the content of another HTML file (like CSS or JS) into the main template.
 * This function is used by scriptlets in the main HTML file.
 *
 * @param {string} filename The name of the file to include (without the '.html' extension).
 * @returns {string} The raw content of the requested file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Gets the active spreadsheet using the ID from script properties.
 * @returns {Spreadsheet} The active spreadsheet.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID is not set. Please run the setup function.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * Gets the 'Clients' sheet from the spreadsheet.
 * @returns {Sheet} The 'Clients' sheet object.
 */
function getClientSheet() {
  return getSpreadsheet().getSheetByName('Clients');
}

/**
 * Retrieves all clients from the 'Clients' sheet.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
  const sheet = getClientSheet();
  if (!sheet) return [];
  // Start from row 2 to skip the header
  const data = sheet.getDataRange().getValues().slice(1);
  return data.map(row => ({
    id: row[0],
    name: row[1],
    email: row[2],
    phone: row[3],
    address: row[4]
  }));
}

/**
 * Adds a new client to the 'Clients' sheet.
 * @param {Object} clientData The client data to add.
 * @returns {Object} The added client object with a new ID.
 */
function addClient(clientData) {
  const sheet = getClientSheet();
  const newId = Utilities.getUuid(); // Generate a unique ID
  sheet.appendRow([
    newId,
    clientData.name,
    clientData.email,
    clientData.phone,
    clientData.address
  ]);
  return { ...clientData, id: newId };
}

/**
 * Updates an existing client's information in the 'Clients' sheet.
 * @param {Object} clientData The client data to update, including the ID.
 * @returns {Object} The updated client object.
 */
function updateClient(clientData) {
  const sheet = getClientSheet();
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] === clientData.id);

  if (rowIndex > 0) { // rowIndex > 0 because of header
    sheet.getRange(rowIndex + 1, 2, 1, 4).setValues([[
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ]]);
    return clientData;
  } else {
    throw new Error('Client not found.');
  }
}

/**
 * Deletes a client from the 'Clients' sheet by their ID.
 * @param {string} clientId The ID of the client to delete.
 * @returns {string} A success message.
 */
function deleteClient(clientId) {
  const sheet = getClientSheet();
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] === clientId);

  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex + 1);
    return 'Client deleted successfully.';
  } else {
    throw new Error('Client not found.');
  }
}

/**
 * Generates an email draft using the Gemini API.
 * The API key is retrieved from Script Properties for security.
 *
 * @param {string} prompt The prompt to send to the Gemini API.
 * @returns {string} The generated email draft text.
 */
function generateEmailDraft(prompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('Gemini API key is not set in Script Properties.');
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{ "text": prompt }]
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
      // Log the full response for debugging if something goes wrong
      console.log('Unexpected Gemini API response:', JSON.stringify(result, null, 2));
      return 'Could not generate email draft. The API returned an unexpected response.';
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error.toString());
    return `Error generating draft: ${error.message}`;
  }
}

/**
 * Sets up the Google Sheet database.
 * This function should be run manually from the Apps Script editor.
 */
function setupDatabase() {
  // Create a new spreadsheet
  const ss = SpreadsheetApp.create('TimeBill Pro Database');
  const spreadsheetId = ss.getId();

  // Store the ID in script properties
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, spreadsheetId);

  // Set up the 'Clients' sheet
  const clientsSheet = ss.getSheetByName('Sheet1');
  clientsSheet.setName('Clients');
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  clientsSheet.setFrozenRows(1);

  // Log the URL for the user
  Logger.log(`Database setup complete. Your new spreadsheet is here: ${ss.getUrl()}`);
  SpreadsheetApp.getUi().alert('Database setup complete!');
}
