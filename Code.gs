// Este archivo contendrá el código del backend de Google Apps Script.
function doGet(e) {
  return HtmlService.createTemplateFromFile('index').evaluate();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Creates the Google Sheet database and sets up initial headers.
 * This function is meant to be run manually once from the Apps Script editor.
 */
function setupDatabase() {
  const SPREADSHEET_ID_KEY = 'spreadsheetId';
  const properties = PropertiesService.getScriptProperties();

  if (properties.getProperty(SPREADSHEET_ID_KEY)) {
    console.log('Database already exists.');
    return;
  }

  const spreadsheet = SpreadsheetApp.create('TimeBillPro Database');
  const spreadsheetId = spreadsheet.getId();
  properties.setProperty(SPREADSHEET_ID_KEY, spreadsheetId);

  // Setup Clients sheet
  const clientsSheet = spreadsheet.getSheetByName('Sheet1');
  clientsSheet.setName('Clients');
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  clientsSheet.setFrozenRows(1);

  // Setup Users sheet
  const usersSheet = spreadsheet.insertSheet('Users');
  usersSheet.appendRow(['ID', 'Username', 'PasswordHash', 'Role']);
  usersSheet.setFrozenRows(1);

  console.log(`Database created. Spreadsheet ID: ${spreadsheetId}`);
}

/**
 * Helper function to get the spreadsheet object.
 */
function getSpreadsheet() {
  const SPREADSHEET_ID_KEY = 'spreadsheetId';
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!spreadsheetId) {
    throw new Error('Database not setup. Please run setupDatabase()');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

// =================== CLIENTS CRUD ===================

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

function addClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const idColumn = sheet.getRange('A2:A').getValues().flat().filter(String);
  const maxId = idColumn.length > 0 ? Math.max(...idColumn) : 0;
  const newId = maxId + 1;
  sheet.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
  return getClients(); // Return updated list
}

function updateClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == clientData.id);

  if (rowIndex > 0) {
    sheet.getRange(rowIndex + 1, 2).setValue(clientData.name);
    sheet.getRange(rowIndex + 1, 3).setValue(clientData.email);
    sheet.getRange(rowIndex + 1, 4).setValue(clientData.phone);
    sheet.getRange(rowIndex + 1, 5).setValue(clientData.address);
  }
  return getClients(); // Return updated list
}

function deleteClient(clientId) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == clientId);

  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex + 1);
  }
  return getClients(); // Return updated list
}

// =================== GEMINI API INTEGRATION ===================

function generateEmailDraft(prompt) {
  const GEMINI_API_KEY_KEY = 'geminiApiKey';
  const apiKey = PropertiesService.getScriptProperties().getProperty(GEMINI_API_KEY_KEY);
  if (!apiKey) {
    throw new Error('Gemini API key not setup. Please set it in the script properties.');
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
    payload: JSON.stringify(payload)
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());
    return result.candidates[0].content.parts[0].text;
  } catch (e) {
    console.error('Error calling Gemini API:', e);
    return 'Error: Could not generate email draft.';
  }
}
