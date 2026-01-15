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
 * The above comment directs App Script to limit the scope of file access for
 * this script to only the current document containing the script.
 */


const SPREADSHEET_ID_KEY = 'spreadsheetId';

/**
 * Serves the HTML for the web app.
 *
 * @param {Object} e The event parameter for a simple get request.
 * @return {HtmlOutput} The HTML to serve.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Includes the content of another HTML file.
 *
 * @param {string} filename The name of the HTML file to include.
 * @return {string} The content of the file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


/**
 * Sets up the Google Sheet database.
 * Creates a new spreadsheet and initializes the "Clients" sheet.
 * Stores the spreadsheet ID in script properties.
 *
 * @return {string} The ID of the newly created spreadsheet.
 */
function setupDatabase() {
  const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
  const spreadsheetId = spreadsheet.getId();

  const clientsSheet = spreadsheet.getSheetByName('Sheet1');
  clientsSheet.setName('Clients');
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  clientsSheet.getRange('A1:E1').setFontWeight('bold');

  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, spreadsheetId);

  console.log('Database setup complete. Spreadsheet ID: ' + spreadsheetId);
  return spreadsheetId;
}

/**
 * Gets the clients sheet from the spreadsheet.
 *
 * @return {Sheet} The clients sheet.
 */
function getClientsSheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!spreadsheetId) {
    throw new Error('Database not set up. Please run setupDatabase() first.');
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  return spreadsheet.getSheetByName('Clients');
}

/**
 * Gets all clients from the database.
 *
 * @return {Array<Object>} An array of client objects.
 */
function getClients() {
  const sheet = getClientsSheet();
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

/**
 * Adds a new client to the database.
 *
 * @param {Object} clientData The data for the new client.
 * @return {Object} The added client object.
 */
function addClient(clientData) {
  const sheet = getClientsSheet();
  const newId = Utilities.getUuid();
  const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];
  sheet.appendRow(newRow);

  return {
    ID: newId,
    Name: clientData.name,
    Email: clientData.email,
    Phone: clientData.phone,
    Address: clientData.address,
  };
}

/**
 * Updates an existing client in the database.
 *
 * @param {Object} clientData The data for the client to update.
 * @return {Object} The updated client object.
 */
function updateClient(clientData) {
  const sheet = getClientsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('ID');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === clientData.ID) {
      const row = data[i];
      headers.forEach((header, j) => {
        if (clientData.hasOwnProperty(header)) {
          row[j] = clientData[header];
        }
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return clientData;
    }
  }

  throw new Error('Client not found');
}

/**
 * Generates an email draft using the Gemini API.
 *
 * @param {Object} invoiceData The data for the invoice.
 * @return {string} The generated email draft.
 */
function generateEmailDraftFromApi(invoiceData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
  if (!apiKey) {
    throw new Error('Gemini API key not set in script properties.');
  }

  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{
      parts: [{
        text: prompt,
      }],
    }],
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const result = JSON.parse(response.getContentText());

  if (result.candidates && result.candidates.length > 0 &&
      result.candidates[0].content && result.candidates[0].content.parts &&
      result.candidates[0].content.parts.length > 0) {
    return result.candidates[0].content.parts[0].text;
  } else {
    console.error('Error generating email draft:', result);
    throw new Error('No se pudo generar el borrador de correo. Inténtalo de nuevo.');
  }
}

/**
 * Deletes a client from the database.
 *
 * @param {string} clientId The ID of the client to delete.
 * @return {string} A success message.
 */
function deleteClient(clientId) {
  const sheet = getClientsSheet();
  const data = sheet.getDataRange().getValues();
  const idIndex = data[0].indexOf('ID');

  for (let i = data.length - 1; i > 0; i--) {
    if (data[i][idIndex] === clientId) {
      sheet.deleteRow(i + 1);
      return 'Client deleted successfully';
    }
  }

  throw new Error('Client not found');
}
