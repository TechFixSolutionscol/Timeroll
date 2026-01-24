function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TimeBill Pro')
    .addItem('Setup Database', 'setupDatabase')
    .addToUi();
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets().map(sheet => sheet.getName());

  if (!sheets.includes('Usuarios')) {
    const userSheet = ss.insertSheet('Usuarios');
    userSheet.appendRow(['ID', 'Username', 'Password']);
    userSheet.appendRow([1, 'admin', 'c7ad44cbad762a5da0a452f9e854fdc1e0e7a52a38015f23f3eab1d80b931dd4']);
  }

  if (!sheets.includes('Clientes')) {
    const clientSheet = ss.insertSheet('Clientes');
    clientSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  }

  if (PropertiesService.getScriptProperties().getProperty('spreadsheetId') === null) {
      PropertiesService.getScriptProperties().setProperty('spreadsheetId', ss.getId());
  }

  SpreadsheetApp.getUi().alert('Database setup complete!');
}

function getSpreadsheet() {
  try {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID not set. Please run the setup first.');
    }
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (e) {
    console.error("Error getting spreadsheet: " + e);
    return null;
  }
}

function doGet(e) {
  if (checkAuth()) {
    return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  } else {
    return HtmlService.createTemplateFromFile('Login').evaluate()
      .setTitle('TimeBill Pro - Login')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function hashPassword(password) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return hash.map(byte => {
    const v = (byte & 0xFF).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function checkAuth() {
  const userProperties = PropertiesService.getUserProperties();
  const session = userProperties.getProperty('session');
  return session !== null;
}

function login(username, password) {
  const ss = getSpreadsheet();
  if (!ss) return false;

  const userSheet = ss.getSheetByName('Usuarios');
  const data = userSheet.getDataRange().getValues();
  const hashedPassword = hashPassword(password);

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username && data[i][2] === hashedPassword) {
      const sessionId = Utilities.getUuid();
      PropertiesService.getUserProperties().setProperty('session', sessionId);
      return true;
    }
  }
  return false;
}

function logout() {
  PropertiesService.getUserProperties().deleteProperty('session');
}

function getClients() {
  const ss = getSpreadsheet();
  if (!ss) return [];
  const sheet = ss.getSheetByName('Clientes');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    let client = {};
    headers.forEach((header, i) => {
      client[header] = row[i];
    });
    return client;
  });
}

function addClient(clientData) {
  const ss = getSpreadsheet();
  if (!ss) return;
  const sheet = ss.getSheetByName('Clientes');
  const data = sheet.getDataRange().getValues();
  const newId = data.length > 0 ? Math.max(...data.slice(1).map(row => row[0])) + 1 : 1;
  sheet.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
}

function updateClient(clientData) {
  const ss = getSpreadsheet();
  if (!ss) return;
  const sheet = ss.getSheetByName('Clientes');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == clientData.id) {
      sheet.getRange(i + 1, 2).setValue(clientData.name);
      sheet.getRange(i + 1, 3).setValue(clientData.email);
      sheet.getRange(i + 1, 4).setValue(clientData.phone);
      sheet.getRange(i + 1, 5).setValue(clientData.address);
      break;
    }
  }
}

function generateEmailDraftGAS(invoiceData) {
  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
    if (!apiKey) {
      return 'Error: API key for Gemini not set in Script Properties.';
    }

    let chatHistory = [{ "role": "user", "parts": [{ "text": prompt }] }];
    const payload = { "contents": chatHistory };
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      return result.candidates[0].content.parts[0].text;
    } else {
      console.error('Gemini API response was invalid:', result);
      return 'No se pudo generar el borrador de correo. La respuesta de la API fue inválida.';
    }
  } catch (error) {
    console.error('Error al llamar a la API de Gemini:', error);
    return 'Error al generar el borrador. Por favor, revisa la configuración y la conexión.';
  }
}

function deleteClient(clientId) {
  const ss = getSpreadsheet();
  if (!ss) return;
  const sheet = ss.getSheetByName('Clientes');
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] == clientId) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}
