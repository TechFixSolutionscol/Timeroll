const USERS_SHEET = 'Usuarios';
const CLIENTS_SHEET = 'Clientes';
const LOG_SHEET = 'Log';

function doGet(e) {
  if (!checkAuth()) {
    const template = HtmlService.createTemplateFromFile('Login');
    return template.evaluate()
        .setTitle('Login - TimeBill Pro')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  const template = HtmlService.createTemplateFromFile('index');
  template.logoUrl = 'https://i.imgur.com/S8a32l7.jpeg';
  return template.evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('TimeBill Pro')
      .addItem('Setup Database', 'setupDatabase')
      .addItem('Set Gemini API Key', 'setGeminiApiKey')
      .addToUi();
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('spreadsheetId', ss.getId());

  // Setup Users Sheet
  let usersSheet = ss.getSheetByName(USERS_SHEET);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(USERS_SHEET);
    usersSheet.getRange('A1:D1').setValues([['Username', 'PasswordHash', 'Salt', 'Role']]);
    // Add a default admin user with a random password
    const salt = Utilities.getUuid();
    const password = Math.random().toString(36).slice(-8);
    const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt)
                                  .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                                  .join('');
    usersSheet.getRange('A2:D2').setValues([['admin', passwordHash, salt, 'admin']]);
    SpreadsheetApp.getUi().alert('Default user "admin" created with password: ' + password + '. Please change it.');
  }

  // Setup Clients Sheet
  let clientsSheet = ss.getSheetByName(CLIENTS_SHEET);
  if (!clientsSheet) {
    clientsSheet = ss.insertSheet(CLIENTS_SHEET);
    clientsSheet.getRange('A1:F1').setValues([['ID', 'Name', 'Email', 'Phone', 'Address', 'IsActive']]);
    clientsSheet.getRange('A2:F2').setValues([[1, 'Cliente de Ejemplo S.A.S', 'ejemplo@correo.com', '3001234567', 'Calle Falsa 123', true]]);
  }

  // Setup Log Sheet
  let logSheet = ss.getSheetByName(LOG_SHEET);
  if (!logSheet) {
    logSheet = ss.insertSheet(LOG_SHEET);
    logSheet.getRange('A1:C1').setValues([['Timestamp', 'User', 'Message']]);
  }

  SpreadsheetApp.getUi().alert('Database setup complete!');
}

function setGeminiApiKey() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt('Enter Gemini API Key', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() == ui.Button.OK) {
    PropertiesService.getScriptProperties().setProperty('geminiApiKey', result.getResponseText());
    ui.alert('API Key saved.');
  }
}

function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not set. Please run the setup.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function checkAuth() {
  const userProperties = PropertiesService.getUserProperties();
  const session = userProperties.getProperty('session');
  return session && JSON.parse(session).expiration > Date.now();
}

function login(username, password) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(USERS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      const salt = data[i][2];
      const correctHash = data[i][1];
      const inputHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt)
                                .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                                .join('');

      if (inputHash === correctHash) {
        const session = {
          user: username,
          role: data[i][3],
          expiration: Date.now() + 1000 * 60 * 60 * 24 // 24-hour session
        };
        PropertiesService.getUserProperties().setProperty('session', JSON.stringify(session));
        return { success: true, redirectUrl: ScriptApp.getService().getUrl() };
      }
    }
  }
  return { success: false, error: 'Invalid username or password.' };
}

function logout() {
  PropertiesService.getUserProperties().deleteProperty('session');
  return ScriptApp.getService().getUrl();
}

function getInitialData() {
  const session = JSON.parse(PropertiesService.getUserProperties().getProperty('session'));
  return {
    clients: getClients(),
    username: session.user,
    logoUrl: 'https://i.imgur.com/S8a32l7.jpeg',
  };
}

function getClients() {
  const sheet = getSpreadsheet().getSheetByName(CLIENTS_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    const client = {};
    headers.forEach((header, i) => {
      client[header] = row[i];
    });
    return client;
  }).filter(client => client.IsActive);
}

function addClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName(CLIENTS_SHEET);
  const idColumn = sheet.getRange('A:A').getValues();
  const maxId = idColumn.reduce((max, row) => Math.max(max, row[0] || 0), 0);
  const newId = maxId + 1;
  sheet.appendRow([newId, clientData.Name, clientData.Email, clientData.Phone, clientData.Address, true]);
  return getClients();
}

function updateClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName(CLIENTS_SHEET);
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == clientData.ID);

  if (rowIndex > 0) {
    sheet.getRange(rowIndex + 1, 2, 1, 4).setValues([[clientData.Name, clientData.Email, clientData.Phone, clientData.Address]]);
  } else {
    throw new Error('Client not found.');
  }
  return getClients();
}

function generateEmailDraft(invoiceData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
  if (!apiKey) {
    throw new Error('Gemini API key is not set.');
  }

  const { client, hours, total } = invoiceData;
  // Simple sanitization
  const sanitizedClientName = String(client.Name).replace(/[^\w\s]/gi, '');
  const sanitizedClientEmail = String(client.Email).replace(/[^\w\s@.]/gi, '');

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${sanitizedClientName} y su correo es ${sanitizedClientEmail}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{ text: prompt }]
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

    if (response.getResponseCode() !== 200) {
      throw new Error(`API Error: ${JSON.stringify(result.error)}`);
    }

    if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0]) {
      return result.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Unexpected API response format.');
    }
  } catch (e) {
    // Log the error for debugging
    const logSheet = getSpreadsheet().getSheetByName(LOG_SHEET);
    logSheet.appendRow([new Date(), Session.getActiveUser().getEmail(), `Gemini API Error: ${e.message}`]);
    throw new Error(`Failed to generate email draft. ${e.message}`);
  }
}

function deleteClient(clientId) {
  const sheet = getSpreadsheet().getSheetByName(CLIENTS_SHEET);
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == clientId);

  if (rowIndex > 0) {
    sheet.getRange(rowIndex + 1, 6).setValue(false); // Set IsActive to false
  } else {
    throw new Error('Client not found.');
  }
  return getClients();
}
