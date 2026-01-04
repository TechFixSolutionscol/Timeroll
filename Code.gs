/**
 * @OnlyCurrentDoc
 *
 * The above comment directs App Script to limit the scope of file access for this script
 * to only the current document containing the script.
 */

/**
 * Serves the HTML of the web application.
 * @param {Object} e The event parameter for a simple get request.
 * @return {HtmlOutput} The HTML to be served.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

/**
 * Includes the content of another HTML file.
 * This is a helper function to be used in scriptlets.
 * @param {string} filename The name of the file to be included.
 * @return {string} The content of the file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * --- DATABASE FUNCTIONS ---
 */

// Function to get the spreadsheet, or null if not set up.
function getSpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty('spreadsheetId');
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

// Sets up the spreadsheet and required sheets.
function setupDatabase() {
  const ss = SpreadsheetApp.create('TimeBill Pro Database');
  const spreadsheetId = ss.getId();

  PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

  // Set up Clients sheet
  const clientsSheet = ss.getSheetByName('Sheet1');
  clientsSheet.setName('Clients');
  clientsSheet.getRange('A1:E1').setValues([['ID', 'Name', 'Email', 'Phone', 'Address']]);
  clientsSheet.setFrozenRows(1);

  return { success: true, spreadsheetId: spreadsheetId, spreadsheetUrl: ss.getUrl() };
}

// Converts sheet data to an array of objects
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

// C - Create
function addClient(clientData) {
  const ss = getSpreadsheet();
  if (!ss) return { error: "Database not set up." };
  const sheet = ss.getSheetByName('Clients');
  const newId = Utilities.getUuid();
  sheet.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
  return { success: true, id: newId };
}

// R - Read
function getClients() {
  const ss = getSpreadsheet();
  if (!ss) return []; // Return empty array if not set up
  const sheet = ss.getSheetByName('Clients');
  return sheetToObjects(sheet);
}

// U - Update
function updateClient(clientData) {
  const ss = getSpreadsheet();
  if (!ss) return { error: "Database not set up." };
  const sheet = ss.getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColIndex = headers.indexOf('ID');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idColIndex] == clientData.id) {
      // Found the row, now update it
      const row = headers.map(header => clientData[header.toLowerCase()] || '');
      // Ensure ID is not overwritten
      row[idColIndex] = clientData.id;
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row.slice(0, headers.length)]);
      return { success: true };
    }
  }
  return { error: "Client not found." };
}

/**
 * --- AI FUNCTIONS ---
 */

// Generate an email draft using the Gemini API
function generateEmailDraftGAS(invoiceData, prompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
  if (!apiKey) {
    return { error: "API key for Gemini is not set up." };
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
  const payload = { contents: chatHistory };

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
      const text = result.candidates[0].content.parts[0].text;
      return { success: true, draft: text };
    } else {
      console.error("Gemini API Response Error:", JSON.stringify(result, null, 2));
      return { error: 'Could not extract draft from API response.' };
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return { error: `Error calling API: ${error.message}` };
  }
}

// D - Delete
function deleteClient(clientId) {
  const ss = getSpreadsheet();
  if (!ss) return { error: "Database not set up." };
  const sheet = ss.getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const idColIndex = data[0].indexOf('ID');

  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][idColIndex] == clientId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: "Client not found." };
}
