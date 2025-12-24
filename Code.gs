// --- Web App Setup ---
function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- API Key Management ---
function setGeminiApiKey(apiKey) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
  return 'API key stored successfully. You can now close this tab.';
}

// --- Client Management (CRUD) ---
const CLIENTS_SHEET_NAME = 'Clients';

function getOrCreateSheet(name) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
        sheet = ss.insertSheet(name);
        if (name === CLIENTS_SHEET_NAME) {
            sheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
        }
    }
    return sheet;
}

function getNextId(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
        return 1;
    }
    // Get the max value from the 'ID' column (assuming it's the first column)
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const maxId = ids.reduce((max, row) => Math.max(max, row[0]), 0);
    return maxId + 1;
}

function getClients() {
  try {
    const sheet = getOrCreateSheet(CLIENTS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // Only headers
    const headers = data.shift(); // Remove header row

    // Find column indices
    const idIndex = headers.indexOf('ID');
    const nameIndex = headers.indexOf('Name');
    const emailIndex = headers.indexOf('Email');
    const phoneIndex = headers.indexOf('Phone');
    const addressIndex = headers.indexOf('Address');

    return data.map(row => ({
      id: row[idIndex],
      name: row[nameIndex],
      email: row[emailIndex],
      phone: row[phoneIndex],
      address: row[addressIndex],
    }));
  } catch (e) {
    Logger.log('Error in getClients: ' + e.message);
    return [];
  }
}

function addClient(clientData) {
  try {
    const sheet = getOrCreateSheet(CLIENTS_SHEET_NAME);
    const newId = getNextId(sheet);
    sheet.appendRow([
      newId,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ]);
    return { ...clientData, id: newId };
  } catch (e) {
    return { error: e.message };
  }
}

function updateClient(clientData) {
  try {
    const sheet = getOrCreateSheet(CLIENTS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('ID');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] == clientData.id) {
        // Found the row to update
        const nameIndex = headers.indexOf('Name');
        const emailIndex = headers.indexOf('Email');
        const phoneIndex = headers.indexOf('Phone');
        const addressIndex = headers.indexOf('Address');

        let rowToUpdate = new Array(headers.length).fill(null);
        rowToUpdate[idIndex] = clientData.id;
        rowToUpdate[nameIndex] = clientData.name;
        rowToUpdate[emailIndex] = clientData.email;
        rowToUpdate[phoneIndex] = clientData.phone;
        rowToUpdate[addressIndex] = clientData.address;

        sheet.getRange(i + 1, 1, 1, headers.length).setValues([rowToUpdate]);
        return clientData;
      }
    }
    return { error: 'Client not found' };
  } catch (e) {
    return { error: e.message };
  }
}

function deleteClient(id) {
  try {
    const sheet = getOrCreateSheet(CLIENTS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const idIndex = data[0].indexOf('ID');

    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][idIndex] == id) {
        sheet.deleteRow(i + 1);
        return { success: true, id: id };
      }
    }
    return { success: false, error: 'Client not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// --- Gemini API Integration ---
function generateEmailDraftSecure(prompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return { error: 'API key not set. Please contact the administrator.' };
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
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

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());
    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      return { text: result.candidates[0].content.parts[0].text };
    } else {
      Logger.log('Unexpected API response: ' + JSON.stringify(result));
      return { error: 'Could not generate draft from API response.' };
    }
  } catch (e) {
    Logger.log('Error calling Gemini API: ' + e.message);
    return { error: 'Failed to generate email draft. ' + e.message };
  }
}
