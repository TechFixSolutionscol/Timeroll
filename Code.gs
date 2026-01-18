/**
 * @OnlyCurrentDoc
 */

function doGet(e) {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setupDatabase() {
  const spreadsheet = SpreadsheetApp.create('TimeBill Pro - Database');
  const spreadsheetId = spreadsheet.getId();
  PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

  const clientsSheet = spreadsheet.getSheetByName('Sheet1');
  clientsSheet.setName('Clients');
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  clientsSheet.setFrozenRows(1);

  Logger.log(`Database setup complete. Spreadsheet ID: ${spreadsheetId}`);
}

function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Database not setup. Please run setupDatabase()');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function sheetDataToObjects(data) {
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

function getClients() {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    return sheetDataToObjects(data);
  } catch (e) {
    return { error: e.message };
  }
}

function addClient(clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const allIds = sheet.getRange(2, 1, sheet.getLastRow(), 1).getValues().flat();
    const newId = allIds.length > 0 ? Math.max(...allIds) + 1 : 1;

    const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];
    sheet.appendRow(newRow);

    return { ID: newId, ...clientData };
  } catch (e) {
    return { error: e.message };
  }
}

function updateClient(clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const idColumnIndex = data[0].indexOf('ID');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumnIndex] == clientData.ID) {
        const row = i + 1;
        sheet.getRange(row, 2).setValue(clientData.name);
        sheet.getRange(row, 3).setValue(clientData.email);
        sheet.getRange(row, 4).setValue(clientData.phone);
        sheet.getRange(row, 5).setValue(clientData.address);
        return { success: true };
      }
    }
    return { error: 'Client not found' };
  } catch (e) {
    return { error: e.message };
  }
}

function deleteClient(clientId) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const idColumnIndex = data[0].indexOf('ID');

    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][idColumnIndex] == clientId) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { error: 'Client not found' };
  } catch (e) {
    return { error: e.message };
  }
}

function generateEmailDraftBackend(invoiceData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
  if (!apiKey) {
    return { error: 'API key for Gemini not set in Script Properties.' };
  }

  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso.`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates[0]) {
      return { draft: result.candidates[0].content.parts[0].text };
    } else {
      return { error: 'No se pudo generar el borrador.' };
    }
  } catch (error) {
    return { error: error.message };
  }
}
