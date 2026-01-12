// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// --- CONFIGURATION ---
const SPREADSHEET_ID_KEY = 'spreadsheetId';
const GEMINI_API_KEY_KEY = 'geminiApiKey';

// --- MAIN FUNCTIONS ---

/**
 * Serves the HTML for the web application.
 * This is the entry point when the user accesses the web app URL.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('templates/index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Includes the content of another HTML file.
 * This is a utility function used within the HTML templates.
 * @param {string} filename The name of the file to include.
 * @return {string} The content of the included file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- DATABASE SETUP ---

/**
 * Sets up the Google Sheet to be used as the database.
 * This function should be run manually from the Apps Script editor.
 */
function setupDatabase() {
  const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
  const spreadsheetId = spreadsheet.getId();

  // Configure Clients sheet
  const clientsSheet = spreadsheet.getSheets()[0];
  clientsSheet.setName('Clients');
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  clientsSheet.setFrozenRows(1);

  // Store the spreadsheet ID in script properties
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, spreadsheetId);

  Logger.log(`Database setup complete. Spreadsheet ID: ${spreadsheetId}`);
  SpreadsheetApp.getUi().alert(`Database setup complete! New Spreadsheet ID: ${spreadsheetId}`);
}


// --- CLIENT MANAGEMENT FUNCTIONS ---

/**
 * Gets the "Clients" sheet from the spreadsheet.
 * @return {Sheet} The "Clients" sheet object.
 */
function getClientsSheet() {
  try {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID not set. Please run 'setupDatabase'.");
    }
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName('Clients');
    if (!sheet) {
      throw new Error("'Clients' sheet not found in the spreadsheet.");
    }
    return sheet;
  } catch (e) {
    Logger.log('Error getting clients sheet: ' + e.message);
    throw new Error('Could not connect to the database. Please ensure setup is complete.');
  }
}

/**
 * Retrieves all clients from the spreadsheet.
 * @return {Array<Object>} An array of client objects.
 */
function getClients() {
  const sheet = getClientsSheet();
  // Get all data, skipping the header row
  const data = sheet.getDataRange().getValues().slice(1);

  if (data.length === 0) {
    return [];
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

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
 * @param {Object} clientData The client data to add.
 * @return {Object} The added client object with the new ID.
 */
function addClient(clientData) {
  const sheet = getClientsSheet();
  const newId = Utilities.getUuid();
  const newRow = [
    newId,
    clientData.Name,
    clientData.Email,
    clientData.Phone,
    clientData.Address
  ];
  sheet.appendRow(newRow);

  return {
    ID: newId,
    Name: clientData.Name,
    Email: clientData.Email,
    Phone: clientData.Phone,
    Address: clientData.Address
  };
}

/**
 * Updates an existing client in the spreadsheet.
 * @param {Object} clientData The client data to update, including the ID.
 * @return {Object} The updated client object.
 */
function updateClient(clientData) {
  const sheet = getClientsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColIndex = headers.indexOf('ID');

  if (idColIndex === -1) {
    throw new Error("'ID' column not found.");
  }

  const rowIndex = data.findIndex(row => row[idColIndex] === clientData.ID);

  if (rowIndex > 0) { // Check > 0 to ensure it's not the header
    const newRow = headers.map(header => clientData[header] || '');
    sheet.getRange(rowIndex + 1, 1, 1, newRow.length).setValues([newRow]);
    return clientData;
  } else {
    throw new Error('Client not found.');
  }
}

/**
 * Deletes a client from the spreadsheet.
 * @param {string} clientId The ID of the client to delete.
 * @return {Object} A success message.
 */
function deleteClient(clientId) {
  const sheet = getClientsSheet();
  const data = sheet.getDataRange().getValues();
  const idColIndex = data[0].indexOf('ID');

  if (idColIndex === -1) {
    throw new Error("'ID' column not found.");
  }

  // Find the row index to delete, starting from the end to avoid shifting issues
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][idColIndex] === clientId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Client deleted successfully.' };
    }
  }

  throw new Error('Client not found for deletion.');
}

// --- GEMINI API FUNCTION ---

/**
 * Generates an email draft using the Gemini API.
 * @param {Object} invoiceData The data for the invoice.
 * @return {string} The generated email draft text.
 */
function generateEmailDraft(invoiceData) {
  const { client, hours, total } = invoiceData;
  const apiKey = PropertiesService.getScriptProperties().getProperty(GEMINI_API_KEY_KEY);

  if (!apiKey) {
    throw new Error("Gemini API key not set in Script Properties.");
  }

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

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
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // Important to see error messages
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    if (responseCode === 200 && result.candidates && result.candidates[0].content.parts[0].text) {
      return result.candidates[0].content.parts[0].text;
    } else {
      Logger.log('Gemini API Error Response: ' + response.getContentText());
      throw new Error('Failed to generate email draft. Reason: ' + (result.error ? result.error.message : 'Unknown error'));
    }
  } catch (e) {
    Logger.log('Error calling Gemini API: ' + e.toString());
    throw new Error('Could not connect to the email generation service.');
  }
}
