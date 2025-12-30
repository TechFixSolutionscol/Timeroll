function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

const SCRIPT_PROPERTY_SHEET_ID = 'sheetId';

function getSpreadsheet() {
  const sheetId = PropertiesService.getScriptProperties().getProperty(SCRIPT_PROPERTY_SHEET_ID);
  if (sheetId) {
    try {
      return SpreadsheetApp.openById(sheetId);
    } catch (e) {
      console.error("Error opening spreadsheet by ID:", e);
      return null;
    }
  }
  return null;
}

function setupSheet(sheetId) {
  PropertiesService.getScriptProperties().setProperty(SCRIPT_PROPERTY_SHEET_ID, sheetId);
  const spreadsheet = getSpreadsheet();
  if (spreadsheet) {
    let clientSheet = spreadsheet.getSheetByName('Clients');
    if (!clientSheet) {
      clientSheet = spreadsheet.insertSheet('Clients');
      clientSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    }
    return `Spreadsheet setup complete. Using sheet ID: ${sheetId}`;
  }
  return 'Failed to setup spreadsheet.';
}

function getClients() {
  const sheet = getSpreadsheet()?.getSheetByName('Clients');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  data.shift(); // Remove header row
  return data.map(row => ({
    id: row[0],
    name: row[1],
    email: row[2],
    phone: row[3],
    address: row[4]
  }));
}

function addClient(client) {
  const sheet = getSpreadsheet()?.getSheetByName('Clients');
  if (!sheet) return null;
  const newId = Utilities.getUuid();
  sheet.appendRow([newId, client.name, client.email, client.phone, client.address]);
  return { ...client, id: newId };
}

function updateClient(client) {
  const sheet = getSpreadsheet()?.getSheetByName('Clients');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] === client.id);
  if (rowIndex > 0) {
    sheet.getRange(rowIndex + 1, 2, 1, 4).setValues([[client.name, client.email, client.phone, client.address]]);
    return client;
  }
  return null;
}

function deleteClient(id) {
  const sheet = getSpreadsheet()?.getSheetByName('Clients');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] === id);
  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex + 1);
  }
}

function generateEmailDraft(prompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
  if (!apiKey) {
    return 'Error: Gemini API key not set in Script Properties.';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    })
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    return result.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return 'Error generating email draft.';
  }
}
