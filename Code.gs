function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
  const clientsSheet = ss.getSheetByName('Clients') || ss.insertSheet('Clients');

  if (usersSheet.getLastRow() === 0) {
    usersSheet.appendRow(['ID', 'Username', 'Password', 'Salt']);
    // Add a default admin user
    const salt = Utilities.getUuid();
    const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'admin' + salt).map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
    usersSheet.appendRow([1, 'admin', passwordHash, salt]);
  }

  if (clientsSheet.getLastRow() === 0) {
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    clientsSheet.appendRow([1, 'Cliente de Ejemplo S.A.S', 'ejemplo@correo.com', '3001234567', 'Calle Falsa 123']);
  }

  return 'Setup Complete!';
}

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values.shift() || [];
  return values.map(row => {
    return headers.reduce((obj, header, i) => {
      obj[header] = row[i];
      return obj;
    }, {});
  });
}

function loginUser(username, password) {
  const users = getSheetData('Users');
  const user = users.find(u => u.Username === username);

  if (user) {
    const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + user.Salt)
      .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
    if (passwordHash === user.Password) {
      return { ID: user.ID, Username: user.Username }; // Don't send password info to client
    }
  }
  return null;
}

function getNextId(sheetName) {
  const data = getSheetData(sheetName);
  return data.reduce((maxId, row) => Math.max(row.ID || 0, maxId), 0) + 1;
}

function getClients() {
  return getSheetData('Clients');
}

function addClient(clientData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Clients');
  const newId = getNextId('Clients');
  clientData.ID = newId;
  const newRow = [newId, clientData.Name, clientData.Email, clientData.Phone, clientData.Address];
  sheet.appendRow(newRow);
  return clientData;
}

function updateClient(clientData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Clients');
  const range = sheet.getDataRange();
  const values = range.getValues();
  const rowIndex = values.findIndex(row => row[0] == clientData.ID);

  if (rowIndex > -1) {
    values[rowIndex] = [clientData.ID, clientData.Name, clientData.Email, clientData.Phone, clientData.Address];
    range.setValues(values);
    return clientData;
  }
  return null;
}

function deleteClient(clientId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Clients');
  const range = sheet.getDataRange();
  const values = range.getValues();
  const rowIndex = values.findIndex(row => row[0] == clientId);

  if (rowIndex > -1) {
    sheet.deleteRow(rowIndex + 1);
    return { id: clientId, success: true };
  }
  return { success: false };
}

// Store API Key securely
function setGeminiApiKey(apiKey) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
  return 'API Key set successfully!';
}

function generateEmailDraft(invoiceData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return 'Error: Gemini API key not set. Please ask the administrator to set it.';
  }

  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

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
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts[0]) {
      return result.candidates[0].content.parts[0].text;
    } else {
      Logger.log('Unexpected API response structure:', result);
      return 'Could not generate email draft. Unexpected response from API.';
    }
  } catch (e) {
    Logger.log('Error calling Gemini API:', e);
    return 'Error generating email draft. Please check the logs.';
  }
}