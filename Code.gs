const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID"; // Replace with your Google Sheet ID

function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('TimeBill Pro')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function createTables() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetNames = ss.getSheets().map(sheet => sheet.getName());

    if (!sheetNames.includes('Users')) {
      const usersSheet = ss.insertSheet('Users');
      usersSheet.appendRow(['ID', 'Username', 'Password']);
      usersSheet.getRange('A1:C1').setFontWeight('bold');
    }

    if (!sheetNames.includes('Clients')) {
      const clientsSheet = ss.insertSheet('Clients');
      clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
      clientsSheet.getRange('A1:E1').setFontWeight('bold');
    }

    return { success: true, message: 'Tables created successfully.' };
  } catch (e) {
    return { success: false, message: 'Error creating tables: ' + e.message };
  }
}

// Client CRUD operations
function getClients() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  data.shift(); // Remove header row
  return data.map(row => ({ id: row[0], name: row[1], email: row[2], phone: row[3], address: row[4] }));
}

function addClient(client) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Clients');
  const newId = getNextId(sheet);
  sheet.appendRow([newId, client.name, client.email, client.phone, client.address]);
  return { id: newId, ...client };
}

function updateClient(client) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == client.id);
  if (rowIndex > -1) {
    sheet.getRange(rowIndex + 1, 2, 1, 4).setValues([[client.name, client.email, client.phone, client.address]]);
    return { success: true };
  }
  return { success: false, message: 'Client not found' };
}

function deleteClient(id) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == id);
  if (rowIndex > -1) {
    sheet.deleteRow(rowIndex + 1);
    return { success: true };
  }
  return { success: false, message: 'Client not found' };
}

function getNextId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 1;
  }
  const lastId = sheet.getRange(lastRow, 1).getValue();
  return lastId + 1;
}

function login(credentials) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    data.shift(); // Remove header row

    // In a real app, hash passwords. For this demo, we'll use plaintext.
    const user = data.find(row => row[1] === credentials.username && row[2] === credentials.password);

    if (user) {
      return { success: true, user: { id: user[0], username: user[1] } };
    } else {
      return { success: false, message: 'Invalid username or password.' };
    }
  } catch (e) {
    // If the Users sheet doesn't exist, no one can log in.
    return { success: false, message: 'Login service not available. Have you created the tables?' };
  }
}

// Admin function to set the API key. Run this manually from the Apps Script editor.
function setGeminiApiKey(apiKey) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
}

function generateEmailDraftBackend(invoiceData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return { success: false, message: 'API key not set. Please ask an admin to set it.' };
  }

  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.name} y su correo es ${client.email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      const text = result.candidates[0].content.parts[0].text;
      return { success: true, draft: text };
    }
    return { success: false, message: 'Could not generate draft from API response.' };
  } catch (e) {
    return { success: false, message: 'Error calling Gemini API: ' + e.message };
  }
}