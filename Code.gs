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
 * @fileoverview This file contains the server-side code for the TimeBill Pro
 * application. It handles serving the web application, data operations with
 * Google Sheets, and secure calls to the Gemini API.
 */

// --- Global Variables ---
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // Replace with your Spreadsheet ID
const CLIENTS_SHEET_NAME = 'Clients';

// --- Web Application Setup ---

/**
 * Serves the HTML for the web application.
 * This is the entry point for the web app.
 *
 * @param {object} e - The event parameter for a simple get request.
 * @returns {HtmlOutput} The HTML output for the web app.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Includes the content of another file in the HTML template.
 * This is a helper function used in the HTML templates to include CSS and JS files.
 *
 * @param {string} filename - The name of the file to include.
 * @returns {string} The content of the file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- CRUD Operations for Clients ---

/**
 * Gets the clients sheet.
 *
 * @returns {Sheet} The clients sheet.
 */
function getClientsSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CLIENTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CLIENTS_SHEET_NAME);
    sheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  }
  return sheet;
}

/**
 * Gets all clients from the spreadsheet.
 *
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
  const sheet = getClientsSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    const client = {};
    headers.forEach((header, i) => {
      client[header.toLowerCase()] = row[i];
    });
    return client;
  });
}

/**
 * Adds a new client to the spreadsheet.
 *
 * @param {Object} clientData - The client data to add.
 * @returns {Object} The client data that was added.
 */
function addClient(clientData) {
  const sheet = getClientsSheet_();
  const newId = generateUniqueId_();
  const newRow = [
    newId,
    clientData.name,
    clientData.email,
    clientData.phone,
    clientData.address
  ];
  sheet.appendRow(newRow);
  clientData.id = newId;
  return clientData;
}

/**
 * Updates an existing client in the spreadsheet.
 *
 * @param {Object} clientData - The client data to update.
 * @returns {Object} The client data that was updated.
 */
function updateClient(clientData) {
  const sheet = getClientsSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('ID');
  const rowIndex = data.findIndex(row => row[idIndex] == clientData.id);

  if (rowIndex > -1) {
    const newRow = headers.map(header => clientData[header.toLowerCase()]);
    sheet.getRange(rowIndex + 1, 1, 1, newRow.length).setValues([newRow]);
    return clientData;
  } else {
    throw new Error('Client not found');
  }
}

/**
 * Deletes a client from the spreadsheet.
 *
 * @param {number} clientId - The ID of the client to delete.
 */
function deleteClient(clientId) {
  const sheet = getClientsSheet_();
  const data = sheet.getDataRange().getValues();
  const idIndex = data[0].indexOf('ID');
  const rowIndex = data.findIndex(row => row[idIndex] == clientId);

  if (rowIndex > -1) {
    sheet.deleteRow(rowIndex + 1);
  } else {
    throw new Error('Client not found');
  }
}

/**
 * Generates a unique ID for a new client.
 *
 * @returns {number} A unique ID.
 */
function generateUniqueId_() {
  const sheet = getClientsSheet_();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return 1;
  }
  const ids = data.slice(1).map(row => row[0]);
  return Math.max(...ids) + 1;
}

// --- Gemini API Integration ---

/**
 * Sets the Gemini API key in the script properties.
 * This should be run once from the Apps Script editor.
 */
function setGeminiApiKey() {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', 'YOUR_API_KEY');
}

/**
 * Generates an email draft using the Gemini API.
 *
 * @param {string} prompt - The prompt to send to the Gemini API.
 * @returns {string} The generated email draft.
 */
function generateEmailDraft(prompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
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
    payload: JSON.stringify(payload)
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());
    return result.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return 'Error generating email draft.';
  }
}
