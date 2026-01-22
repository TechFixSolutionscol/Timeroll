/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Global variable for script properties
const SCRIPT_PROPS = PropertiesService.getScriptProperties();

// --- Main App Functions ---

// Function to serve the main HTML page
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// Function to include HTML partials in our main page
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- Database Setup ---

/**
 * Creates a custom menu in the spreadsheet UI to run the setup.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('TimeBill Pro')
      .addItem('Setup Database', 'setupDatabase')
      .addToUi();
}

/**
 * Creates the initial spreadsheet and sets it up with the necessary headers.
 * This function is intended to be run manually once from the script editor or the custom menu.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.create('TimeBillPro_Database');
  SCRIPT_PROPS.setProperty('spreadsheetId', ss.getId());

  const sheet = ss.getSheets()[0];
  sheet.setName('Clients');

  const headers = ['ID', 'Name', 'Email', 'Phone', 'Address'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Add sample data
  sheet.appendRow([1, 'Cliente de Ejemplo S.A.S', 'ejemplo@correo.com', '3001234567', 'Calle Falsa 123']);

  SpreadsheetApp.getUi().alert('Database Setup Complete!', `The spreadsheet has been created. Don't forget to set your Gemini API key in the script properties.`, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Helper function to get the spreadsheet instance.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The spreadsheet object.
 */
function getSpreadsheet() {
  const spreadsheetId = SCRIPT_PROPS.getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not set. Please run the setupDatabase function first.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

// --- Client CRUD Operations ---

/**
 * Retrieves all clients from the spreadsheet.
 * @returns {Array<Object>} An array of client objects.
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
 * Adds a new client to the spreadsheet.
 * @param {Object} clientData - The client data to add.
 * @returns {Object} The newly created client object with its ID.
 */
function addClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const ids = data.slice(1).map(row => row[0]); // Get all existing IDs
  const newId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

  const newRow = [
    newId,
    clientData.name,
    clientData.email,
    clientData.phone,
    clientData.address
  ];

  sheet.appendRow(newRow);

  return { id: newId, ...clientData };
}

/**
 * Updates an existing client's information.
 * @param {Object} clientData - The client data to update, must include an ID.
 * @returns {Object} A status object.
 */
function updateClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('ID');

  const rowIndex = data.findIndex(row => row[idIndex] == clientData.id);

  if (rowIndex === -1) {
    return { status: 'error', message: 'Client not found' };
  }

  const rowToUpdate = [
    clientData.id,
    clientData.name,
    clientData.email,
    clientData.phone,
    clientData.address
  ];

  sheet.getRange(rowIndex + 1, 1, 1, rowToUpdate.length).setValues([rowToUpdate]);
  return { status: 'success', data: clientData };
}

/**
 * Deletes a client from the spreadsheet.
 * @param {number} clientId - The ID of the client to delete.
 * @returns {Object} A status object.
 */
function deleteClient(clientId) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('ID');

  const rowIndex = data.findIndex(row => row[idIndex] == clientId);

  if (rowIndex === -1) {
    return { status: 'error', message: 'Client not found' };
  }

  sheet.deleteRow(rowIndex + 1);
  return { status: 'success' };
}

// --- Gemini API Integration ---

/**
 * Calls the Gemini API to generate an email draft.
 * @param {string} prompt - The prompt to send to the Gemini API.
 * @returns {string} The generated text from the API.
 */
function generateEmailDraft(prompt) {
  const apiKey = SCRIPT_PROPS.getProperty('geminiApiKey');
  if (!apiKey) {
    return 'Error: Gemini API key not set in Script Properties.';
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

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
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() === 200 && result.candidates && result.candidates[0].content.parts[0].text) {
      return result.candidates[0].content.parts[0].text;
    } else {
      Logger.log('Gemini API Error Response:', result);
      return `Error: ${result.error ? result.error.message : 'Could not generate content.'}`;
    }
  } catch (error) {
    Logger.log('Error calling Gemini API:', error);
    return 'An unexpected error occurred while contacting the Gemini API.';
  }
}
