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

// --- Global Variables & Constants ---
const SS = SpreadsheetApp.getActiveSpreadsheet();
const USERS_SHEET_NAME = 'Users';
const CLIENTS_SHEET_NAME = 'Clients';
const INVOICES_SHEET_NAME = 'Invoices';

// --- Web App Deployment ---

/**
 * Serves the HTML of the web app.
 * This is the primary function that runs when a user accesses the web app URL.
 * @param {Object} e - The event parameter for a web app request.
 * @returns {HtmlOutput} The HTML page to be served.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Includes the content of other files (like CSS or JS) into the main HTML file.
 * This allows for modular and cleaner code by separating styles and scripts.
 * Used as a scriptlet `< ?!= include('filename_without_extension'); ? >` in the HTML template.
 * @param {string} filename - The name of the file to include (e.g., 'styles' or 'scripts').
 * @returns {string} The content of the specified file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


// --- Database Setup ---

/**
 * Sets up the required sheets in the Google Spreadsheet.
 * Creates 'Users', 'Clients', and 'Invoices' sheets with predefined headers
 * if they don't already exist. This is useful for initial setup.
 */
function setup() {
  const sheetNames = [USERS_SHEET_NAME, CLIENTS_SHEET_NAME, INVOICES_SHEET_NAME];
  const headers = {
    [USERS_SHEET_NAME]: ['ID', 'Username', 'PasswordHash', 'Salt'],
    [CLIENTS_SHEET_NAME]: ['ID', 'Name', 'Email', 'Phone', 'Address', 'UserID'],
    [INVOICES_SHEET_NAME]: ['ID', 'ClientID', 'DateTime', 'DurationHours', 'Rate', 'Total', 'UserID']
  };

  sheetNames.forEach(name => {
    let sheet = SS.getSheetByName(name);
    if (!sheet) {
      sheet = SS.insertSheet(name);
      const headerRow = headers[name];
      sheet.appendRow(headerRow);
      // Freeze header row for better usability
      sheet.setFrozenRows(1);
      // Optional: Apply basic formatting
      const headerRange = sheet.getRange(1, 1, 1, headerRow.length);
      headerRange.setFontWeight('bold').setBackground('#f0f0f0');
    }
  });
   // Add a default user for demonstration purposes
  const usersSheet = SS.getSheetByName(USERS_SHEET_NAME);
  if (usersSheet.getLastRow() < 2) { // Only add if no users exist
    const salt = Utilities.getUuid();
    const passHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'demo' + salt)
                              .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                              .join('');
    usersSheet.appendRow([1, 'demo', passHash, salt]);
  }
}


// --- Utility / Helper Functions ---

/**
 * Generates the next available ID for a new record in a given sheet.
 * It finds the maximum value in the first column (ID column) and adds 1.
 * This prevents ID conflicts and ensures uniqueness.
 * @param {Sheet} sheet - The Google Sheet object to scan for the max ID.
 * @returns {number} The next sequential ID.
 */
function getNextId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 1; // Start with ID 1 if no data exists
  }
  const idRange = sheet.getRange(2, 1, lastRow - 1, 1);
  const ids = idRange.getValues();
  const maxId = ids.reduce((max, row) => Math.max(max, row[0]), 0);
  return maxId + 1;
}

/**
 * A simple utility to get all data from a sheet, skipping the header.
 * @param {string} sheetName - The name of the sheet.
 * @returns {Array<Array<any>>} A 2D array of the sheet data.
 */
function getSheetData(sheetName) {
    const sheet = SS.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) {
        return [];
    }
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
}

// --- User Authentication ---

/**
 * Retrieves the salt for a given username.
 * @param {string} username - The username to look up.
 * @returns {string|null} The user's salt, or null if not found.
 */
function getUserSalt(username) {
  const usersSheet = SS.getSheetByName(USERS_SHEET_NAME);
  const data = getSheetData(USERS_SHEET_NAME);
  for (let i = 0; i < data.length; i++) {
    if (data[i][1].toLowerCase() === username.toLowerCase()) {
      return data[i][3]; // Return salt
    }
  }
  return null;
}

/**
 * Attempts to log in a user with a username and password.
 * Hashes the provided password with the user's salt and compares it to the stored hash.
 * @param {string} username - The user's username.
 * @param {string} password - The user's plain-text password.
 * @returns {Object} An object indicating success and a message or user data.
 */
function loginUser(username, password) {
  const usersSheet = SS.getSheetByName(USERS_SHEET_NAME);
  const data = getSheetData(USERS_SHEET_NAME);

  for (let i = 0; i < data.length; i++) {
    // Check if username matches (case-insensitive)
    if (data[i][1].toLowerCase() === username.toLowerCase()) {
      const storedHash = data[i][2];
      const salt = data[i][3];

      // Hash the provided password with the stored salt
      const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt)
                                  .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                                  .join('');

      if (passwordHash === storedHash) {
        return { success: true, message: 'Login successful!', userId: data[i][0] };
      } else {
        // Found user but password was wrong
        return { success: false, message: 'Invalid username or password.' };
      }
    }
  }
  // User not found
  return { success: false, message: 'Invalid username or password.' };
}


// --- Client Management (CRUD) ---

/**
 * Retrieves all clients associated with a specific user ID.
 * @param {number} userId - The ID of the user whose clients to fetch.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients(userId) {
  const clientsSheet = SS.getSheetByName(CLIENTS_SHEET_NAME);
  const allClients = getSheetData(CLIENTS_SHEET_NAME);

  // Filter clients by userId and map to object for easier use on the frontend
  const userClients = allClients
    .filter(row => row[5] == userId) // Filter by UserID column
    .map(row => ({
      id: row[0],
      name: row[1],
      email: row[2],
      phone: row[3],
      address: row[4]
    }));

  return userClients;
}

/**
 * Adds a new client to the database.
 * @param {Object} clientData - An object containing the new client's details.
 * @param {number} userId - The ID of the user adding the client.
 * @returns {Object} The newly created client object, including its new ID.
 */
function addClient(clientData, userId) {
  const clientsSheet = SS.getSheetByName(CLIENTS_SHEET_NAME);
  const newId = getNextId(clientsSheet);

  const newRow = [
    newId,
    clientData.name,
    clientData.email,
    clientData.phone,
    clientData.address,
    userId
  ];

  clientsSheet.appendRow(newRow);

  return { ...clientData, id: newId };
}

/**
 * Updates an existing client's information efficiently.
 * @param {Object} clientData - An object containing the client's updated details, including the ID.
 * @param {number} userId - The ID of the user making the update for verification.
 * @returns {Object} An object indicating success or failure.
 */
function updateClient(clientData, userId) {
  const clientsSheet = SS.getSheetByName(CLIENTS_SHEET_NAME);
  const data = clientsSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) { // Start from row 2 (index 1)
    // Check if the client ID matches and belongs to the current user
    if (data[i][0] == clientData.id && data[i][5] == userId) {
      // Prepare the entire row for a single, efficient update
      const rowData = [
        clientData.id,
        clientData.name,
        clientData.email,
        clientData.phone,
        clientData.address,
        userId
      ];
      // Update the entire row in one go
      clientsSheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
      return { success: true, message: 'Client updated successfully.' };
    }
  }

  return { success: false, message: 'Client not found or access denied.' };
}

/**
 * Deletes a client from the database.
 * @param {number} clientId - The ID of the client to delete.
 * @param {number} userId - The ID of the user making the request for verification.
 * @returns {Object} An object indicating success or failure.
 */
function deleteClient(clientId, userId) {
  const clientsSheet = SS.getSheetByName(CLIENTS_SHEET_NAME);
  const data = clientsSheet.getDataRange().getValues();

  // Iterate backwards to avoid issues with row indexing after deletion
  for (let i = data.length - 1; i >= 1; i--) {
    // Check if the client ID matches and belongs to the current user
    if (data[i][0] == clientId && data[i][5] == userId) {
      clientsSheet.deleteRow(i + 1);
      return { success: true, message: 'Client deleted successfully.' };
    }
  }

  return { success: false, message: 'Client not found or access denied.' };
}


// --- Invoice Management ---

/**
 * Adds a new invoice record to the database.
 * @param {Object} invoiceData - An object containing invoice details (client, hours, rate, total).
 * @param {number} userId - The ID of the user creating the invoice.
 * @returns {Object} An object indicating success.
 */
function addInvoice(invoiceData, userId) {
    const invoicesSheet = SS.getSheetByName(INVOICES_SHEET_NAME);
    const newId = getNextId(invoicesSheet);

    const newRow = [
        newId,
        invoiceData.client.id,
        new Date(),
        invoiceData.hours,
        invoiceData.rate,
        invoiceData.total,
        userId
    ];

    invoicesSheet.appendRow(newRow);
    return { success: true, message: 'Invoice recorded successfully.' };
}

// --- Generative AI ---

/**
 * Generates an email draft using the Gemini API.
 * This function is called from the client-side, but the API call is made securely from the backend.
 * @param {Object} invoiceData - The same data object used for the invoice modal.
 * @returns {string} The generated email content.
 */
function generateEmailDraft(invoiceData) {
  const apiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('API key not set. Please ask the administrator to set it.');
  }

  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.name}. El correo debe ser conciso y agradecerle.`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      role: "user",
      parts: [{ "text": prompt }]
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // Important to catch potential errors
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();
  const result = JSON.parse(response.getContentText());

  if (responseCode === 200) {
    if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
      return result.candidates[0].content.parts[0].text;
    } else {
      // Handle cases where the API returns a 200 but no valid content
      throw new Error('Failed to generate draft. The API returned an unexpected response.');
    }
  } else {
    // Handle API errors (e.g., invalid key, billing issues)
    const errorMessage = result.error ? result.error.message : 'An unknown API error occurred.';
    throw new Error(`API Error: ${errorMessage} (Code: ${responseCode})`);
  }
}

/**
 * Helper function to allow the project owner to set the Gemini API Key.
 * To use, open the Apps Script Editor, select this function from the dropdown,
 * and click "Run". You will be prompted to enter your API key.
 * @param {string} apiKey - The Gemini API key to store securely.
 */
function setGeminiApiKey(apiKey) {
  // Use UserProperties for storing the key, scoped to the user running the script.
  PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', apiKey);
  Logger.log('Gemini API key has been set successfully.');
}