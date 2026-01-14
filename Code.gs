// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Main backend script for TimeBill Pro.
 * This script handles serving the web application, database setup,
 * user authentication, client data management (CRUD), and proxying
 * API calls to the Gemini API.
 */

// --- Constants ---

const SPREADSHEET_ID_KEY = 'spreadsheetId';
const GEMINI_API_KEY_PROPERTY = 'geminiApiKey';

// --- Web App ---

/**
 * Serves the main HTML page of the web application.
 * This is the entry point for the web app.
 * @param {object} e - The event parameter for a simple GET request.
 * @returns {HtmlOutput} The HTML service output.
 */
function doGet(e) {
  const html = HtmlService.createTemplateFromFile('templates/index').evaluate();
  html.setTitle('TimeBill Pro');
  html.addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  return html;
}

/**
 * Includes the content of another file into the main HTML template.
 * This function is used within the HTML templates to include CSS and JS files.
 * @param {string} filename - The name of the file to include.
 * @returns {string} The content of the specified file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- Database ---

/**
 * Retrieves the active spreadsheet using the ID stored in Script Properties.
 * @returns {Spreadsheet} The spreadsheet object or null if not found.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (spreadsheetId) {
    try {
      return SpreadsheetApp.openById(spreadsheetId);
    } catch (e) {
      console.error("Could not open spreadsheet with ID:", spreadsheetId, e);
      return null;
    }
  }
  return null;
}

/**
 * Sets up the Google Sheet database.
 * Creates a new spreadsheet, sets up "Clients" and "Users" sheets with headers,
 * and stores the new spreadsheet's ID in Script Properties.
 * @returns {object} An object indicating success and the spreadsheet ID, or an error message.
 */
function setupDatabase() {
  try {
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();
    PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, spreadsheetId);

    // Setup Clients Sheet
    const clientsSheet = spreadsheet.getSheets()[0];
    clientsSheet.setName('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    clientsSheet.setFrozenRows(1);

    // Setup Users Sheet
    const usersSheet = spreadsheet.insertSheet('Users');
    usersSheet.appendRow(['ID', 'Email', 'PasswordHash', 'Salt']);
    usersSheet.setFrozenRows(1);

    console.log('Database setup successful. ID:', spreadsheetId);
    return { success: true, spreadsheetId: spreadsheetId };
  } catch (e) {
    console.error('Error setting up database:', e);
    return { success: false, error: e.message };
  }
}

// --- User Authentication ---

/**
 * Registers a new user.
 * Checks if the user already exists. If not, hashes the password with a new salt
 * and saves the user to the "Users" sheet.
 * @param {string} email - The user's email.
 * @param {string} password - The user's plaintext password.
 * @returns {object} An object indicating success or an error message.
 */
function registerUser(email, password) {
  const usersSheet = getSpreadsheet()?.getSheetByName('Users');
  if (!usersSheet) {
    return { success: false, error: 'La hoja de usuarios no está configurada.' };
  }

  const users = usersSheet.getDataRange().getValues();
  const userExists = users.slice(1).some(row => row[1].toLowerCase() === email.toLowerCase());

  if (userExists) {
    return { success: false, error: 'Este correo electrónico ya está registrado.' };
  }

  const salt = Utilities.getUuid();
  const passwordHash = hashPassword(password, salt);
  const userId = Utilities.getUuid();

  usersSheet.appendRow([userId, email, passwordHash, salt]);

  return { success: true };
}

/**
 * Logs in a user.
 * Finds the user by email, re-hashes the provided password with the stored salt,
 * and compares it to the stored hash.
 * @param {string} email - The user's email.
 * @param {string} password - The user's plaintext password.
 * @returns {object} An object indicating success and user data, or an error message.
 */
function loginUser(email, password) {
  const usersSheet = getSpreadsheet()?.getSheetByName('Users');
  if (!usersSheet) {
    return { success: false, error: 'La base de datos de usuarios no está configurada.' };
  }

  const usersData = usersSheet.getDataRange().getValues();
  const headers = usersData[0];
  const emailCol = headers.indexOf('Email');
  const hashCol = headers.indexOf('PasswordHash');
  const saltCol = headers.indexOf('Salt');

  const userRow = usersData.slice(1).find(row => row[emailCol].toLowerCase() === email.toLowerCase());

  if (!userRow) {
    return { success: false, error: 'Usuario o contraseña incorrectos.' };
  }

  const storedHash = userRow[hashCol];
  const salt = userRow[saltCol];
  const inputHash = hashPassword(password, salt);

  if (inputHash === storedHash) {
    return {
      success: true,
      user: {
        ID: userRow[headers.indexOf('ID')],
        Email: userRow[emailCol]
      }
    };
  } else {
    return { success: false, error: 'Usuario o contraseña incorrectos.' };
  }
}

// --- Client Management (CRUD) ---

/**
 * Converts a 2D array from a sheet to an array of objects.
 * @param {Array<Array<string>>} data - The 2D array from sheet.getDataRange().getValues().
 * @returns {Array<object>} An array of objects.
 */
function sheetDataToObject(data) {
    if (data.length < 2) return [];
    const headers = data[0];
    return data.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index];
        });
        return obj;
    });
}


/**
 * Retrieves all clients from the "Clients" sheet.
 * @returns {Array<object>} An array of client objects.
 */
function getClients() {
  const clientsSheet = getSpreadsheet()?.getSheetByName('Clients');
  if (!clientsSheet) return [];
  const data = clientsSheet.getDataRange().getValues();
  return sheetDataToObject(data);
}

/**
 * Adds a new client to the "Clients" sheet.
 * @param {object} clientData - The client's data.
 * @returns {object} The newly added client object.
 */
function addClient(clientData) {
  const clientsSheet = getSpreadsheet().getSheetByName('Clients');
  const newId = Utilities.getUuid();
  clientData.ID = newId;
  const newRow = [newId, clientData.Name, clientData.Email, clientData.Phone, clientData.Address];
  clientsSheet.appendRow(newRow);
  return clientData;
}

/**
 * Updates an existing client's information.
 * @param {object} clientData - The client data to update, including ID.
 */
function updateClient(clientData) {
  const clientsSheet = getSpreadsheet().getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('ID');

  const rowIndex = data.findIndex(row => row[idCol] === clientData.ID);

  if (rowIndex > 0) {
    const row = headers.map(header => clientData[header] || '');
    clientsSheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([row]);
  }
}

/**
 * Deletes a client from the "Clients" sheet.
 * @param {string} clientId - The ID of the client to delete.
 */
function deleteClient(clientId) {
  const clientsSheet = getSpreadsheet().getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  const idCol = data[0].indexOf('ID');

  const rowIndex = data.findIndex(row => row[idCol] === clientId);

  if (rowIndex > 0) {
    clientsSheet.deleteRow(rowIndex + 1);
  }
}

// --- API Services ---

/**
 * Generates an email draft using the Gemini API.
 * The API key is retrieved from Script Properties for security.
 * @param {string} prompt The prompt to send to the Gemini API.
 * @returns {object} An object with the draft or an error message.
 */
function generateEmailDraft(prompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(GEMINI_API_KEY_PROPERTY);
  if (!apiKey) {
    return { success: false, error: 'La clave API de Gemini no está configurada en las propiedades del script.' };
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key=${apiKey}`;

  try {
    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    };
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates[0].content.parts[0].text) {
      return { success: true, draft: result.candidates[0].content.parts[0].text };
    } else {
      return { success: false, error: 'No se pudo generar el borrador de correo. La respuesta de la API no fue la esperada.' };
    }
  } catch (e) {
    console.error('Error calling Gemini API:', e);
    return { success: false, error: `Error al contactar el servicio de IA: ${e.message}` };
  }
}
