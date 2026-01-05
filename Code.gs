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

/**
 * @OnlyCurrentDoc
 *
 * The above comment directs App Script to limit the scope of file authorization now that the OAuth installer script has been removed.
 * This sample demonstrates how to build a web app with Google Apps Script,
 * and is intended to accompany the corresponding blog post.
 *
 */

/**
 * Serves the web app's HTML frontend.
 *
 * @param {Object} e event parameter.
 * @return {HtmlService.HtmlOutput} The HTML to serve.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('templates/index').evaluate();
}

/**
 * Includes the content of another file.
 *
 * @param {string} filename The file to include.
 * @return {string} The content of the file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(`templates/${filename}`).getContent();
}

/**
 * Creates a new Google Sheet and sets it up as the database.
 * This function is intended to be called from the client-side UI.
 */
function setupDatabase() {
  try {
    // Create a new spreadsheet
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();

    // Store the spreadsheet ID in script properties
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

    // Get the first sheet and rename it to 'Clients'
    const clientsSheet = spreadsheet.getSheets()[0];
    clientsSheet.setName('Clients');

    // Set headers for the 'Clients' sheet
    const clientHeaders = ['ID', 'Name', 'Email', 'Phone', 'Address'];
    clientsSheet.getRange(1, 1, 1, clientHeaders.length).setValues([clientHeaders]);

    // Create a new sheet for 'Users'
    const usersSheet = spreadsheet.insertSheet('Users');

    // Set headers for the 'Users' sheet
    const userHeaders = ['ID', 'Username', 'Password']; // Simple auth, consider more secure methods for production
    usersSheet.getRange(1, 1, 1, userHeaders.length).setValues([userHeaders]);

    // Add a default user for demonstration purposes
    const hashedPassword = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'password');
    const hashedPasswordStr = hashedPassword.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
    const defaultUser = ['user001', 'demo', hashedPasswordStr];
    usersSheet.getRange(2, 1, 1, defaultUser.length).setValues([defaultUser]);


    return { success: true, message: 'Database created successfully!', spreadsheetId: spreadsheetId };
  } catch (error) {
    console.error('Error setting up database:', error);
    return { success: false, message: `Error: ${error.message}` };
  }
}

/**
 * Checks if the database (spreadsheet) has been set up.
 * @return {boolean} True if the spreadsheetId is stored in script properties.
 */
function checkDatabase() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  return !!spreadsheetId;
}

/**
 * A helper function to get the database spreadsheet.
 * @return {Spreadsheet} The spreadsheet object or null if not found.
 */
function getDB() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    return null;
  }
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (e) {
    console.error("Could not open spreadsheet with ID:", spreadsheetId, e);
    return null;
  }
}

/**
 * Authenticates a user.
 * @param {string} username The user's username.
 * @param {string} password The user's password.
 * @return {Object} An object indicating success or failure.
 */
function login(username, password) {
  const db = getDB();
  if (!db) {
    return { success: false, message: 'Database not set up.' };
  }
  const usersSheet = db.getSheetByName('Users');
  const users = usersSheet.getDataRange().getValues();

  // Skip header row and find the user
  const hashedPassword = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  const hashedPasswordStr = hashedPassword.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');

  for (let i = 1; i < users.length; i++) {
    const user = users[i];
    if (user[1] === username && user[2] === hashedPasswordStr) { // Username in col B, Password in col C
      return { success: true, user: { id: user[0], username: user[1] } };
    }
  }

  return { success: false, message: 'Invalid username or password.' };
}

/**
 * Gets all clients from the 'Clients' sheet.
 * @return {Array} An array of client objects.
 */
function getClients() {
  const db = getDB();
  if (!db) return [];
  const clientsSheet = db.getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  const headers = data.shift(); // Remove header row
  return data.map(row => {
    let client = {};
    headers.forEach((header, i) => {
      client[header] = row[i];
    });
    return client;
  });
}

/**
 * Adds a new client to the 'Clients' sheet.
 * @param {Object} clientData The client data to add.
 * @return {Object} The client data that was added, including the new ID.
 */
function addClient(clientData) {
  const db = getDB();
  const clientsSheet = db.getSheetByName('Clients');
  const newId = Utilities.getUuid();
  const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];
  clientsSheet.appendRow(newRow);
  clientData.ID = newId;
  return clientData;
}

/**
 * Updates an existing client in the 'Clients' sheet.
 * @param {Object} clientData The client data to update.
 * @return {Object} The updated client data.
 */
function updateClient(clientData) {
  const db = getDB();
  const clientsSheet = db.getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  const headers = data[0];
  const idColIndex = headers.indexOf('ID');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idColIndex] == clientData.ID) {
      const row = i + 1;
      const updatedRow = [clientData.ID, clientData.name, clientData.email, clientData.phone, clientData.address];
      clientsSheet.getRange(row, 1, 1, updatedRow.length).setValues([updatedRow]);
      return clientData;
    }
  }
  throw new Error('Client not found.');
}

/**
 * Deletes a client from the 'Clients' sheet.
 * @param {string} clientId The ID of the client to delete.
 * @return {boolean} True if the client was deleted.
 */
function deleteClient(clientId) {
  const db = getDB();
  const clientsSheet = db.getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  const headers = data[0];
  const idColIndex = headers.indexOf('ID');

  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][idColIndex] == clientId) {
      clientsSheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/**
 * Generates an email draft using the Gemini API.
 * @param {Object} invoiceData The data for the invoice.
 * @return {string} The generated email draft.
 */
function generateEmailDraft(invoiceData) {
  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
    if (!apiKey) {
      throw new Error("Gemini API key is not set in Script Properties.");
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
  } catch (error) {
    console.error('Error llamando a la API de Gemini:', error);
    return `Error al generar el borrador: ${error.message}`;
  }
}
