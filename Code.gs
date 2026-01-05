function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

const SPREADSHEET_ID_KEY = 'spreadsheetId';

function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not set up. Please run the setup function.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getSheet(name) {
  const ss = getSpreadsheet();
  return ss.getSheetByName(name);
}

function getClients() {
  try {
    const sheet = getSheet('Clients');
    if (!sheet) return []; // If sheet doesn't exist, return empty array
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // Only header row or empty
    const headers = data[0];
    return data.slice(1).map(row => {
      const client = {};
      headers.forEach((header, i) => {
        client[header] = row[i];
      });
      return client;
    });
  } catch (e) {
    // If spreadsheet is not set up, it will throw an error. Return empty array for initial load.
    return [];
  }
}

function addClient(clientData) {
  const sheet = getSheet('Clients');
  const newId = Utilities.getUuid();
  clientData.ID = newId;
  const headers = sheet.getDataRange().getValues()[0];
  const newRow = headers.map(header => clientData[header] || '');
  sheet.appendRow(newRow);
  return clientData;
}

function updateClient(clientData) {
  const sheet = getSheet('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColumnIndex = headers.indexOf('ID');

  if (idColumnIndex === -1) {
    throw new Error('ID column not found.');
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][idColumnIndex] == clientData.ID) {
      const newRow = headers.map(header => clientData[header] || '');
      sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
      return clientData;
    }
  }
  throw new Error('Client not found for update.');
}

function deleteClient(clientId) {
  const sheet = getSheet('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColumnIndex = headers.indexOf('ID');

  if (idColumnIndex === -1) {
    throw new Error('ID column not found.');
  }

  for (let i = data.length - 1; i > 0; i--) { // Iterate backwards to avoid issues with row deletion
    if (data[i][idColumnIndex] == clientId) {
      sheet.deleteRow(i + 1);
      return { success: true, id: clientId };
    }
  }
  throw new Error('Client not found for deletion.');
}

function generateEmailDraft(invoiceData) {
  const { client, hours, total } = invoiceData;
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');

  if (!apiKey) {
    throw new Error('API key for Gemini is not set up. Please configure it in the script properties.');
  }

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

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

    if (result.candidates && result.candidates[0] && result.candidates[0].content.parts[0]) {
      return result.candidates[0].content.parts[0].text;
    } else {
      console.error('Unexpected API response structure:', JSON.stringify(result, null, 2));
      throw new Error('Could not extract the text from the API response.');
    }
  } catch (e) {
    console.error('Error calling Gemini API:', e.toString());
    throw new Error('Failed to generate email draft. Details: ' + e.message);
  }
}

function setupDatabase() {
  const ss = SpreadsheetApp.create('TimeBill Pro Database');
  const sheet = ss.getActiveSheet();
  sheet.setName('Clients');
  const headers = ['ID', 'Name', 'Email', 'Phone', 'Address'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, ss.getId());
  return { success: true, spreadsheetId: ss.getId() };
}
