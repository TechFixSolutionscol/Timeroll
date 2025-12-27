const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID"; // Replace with your Google Sheet ID

function doGet() {
  const template = HtmlService.createTemplateFromFile('index');
  template.mode = HtmlService.XFrameOptionsMode.ALLOWALL;
  return template.evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function createTables() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Create Users sheet if it doesn't exist
    let usersSheet = ss.getSheetByName('Users');
    if (!usersSheet) {
      usersSheet = ss.insertSheet('Users');
      usersSheet.appendRow(['ID', 'Name', 'Email', 'HashedPassword', 'Salt']);
    }

    // Create Clients sheet if it doesn't exist
    let clientsSheet = ss.getSheetByName('Clients');
    if (!clientsSheet) {
      clientsSheet = ss.insertSheet('Clients');
      clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    }

    return { success: true, message: 'Tables created successfully.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function setGeminiApiKey(apiKey) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
}

function generateEmailDraft(client, hours, total) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return { success: false, message: 'API key not set.' };
  }

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.name} y su correo es ${client.email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  try {
    const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
    const payload = { contents: chatHistory };
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });

    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      const text = result.candidates[0].content.parts[0].text;
      return { success: true, draft: text };
    } else {
      return { success: false, message: 'No se pudo generar el borrador de correo.' };
    }
  } catch (error) {
    return { success: false, message: 'Error al llamar a la API de Gemini: ' + error.toString() };
  }
}

function generateSalt() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function hashPassword(password, salt) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt);
  return Utilities.base64Encode(digest);
}

function verifyPassword(password, salt, hashedPassword) {
  return hashPassword(password, salt) === hashedPassword;
}

function signup(name, email, password) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    const existingUser = data.find(row => row[2] === email);
    if (existingUser) {
      return { success: false, message: 'User already exists.' };
    }
    const salt = generateSalt();
    const hashedPassword = hashPassword(password, salt);
    const newId = getNextId(sheet);
    sheet.appendRow([newId, name, email, hashedPassword, salt]);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function login(email, password) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    const userRow = data.find(row => row[2] === email);
    if (userRow) {
      const hashedPassword = userRow[3];
      const salt = userRow[4];
      if (verifyPassword(password, salt, hashedPassword)) {
        // Store session token
        const sessionToken = generateSalt();
        PropertiesService.getUserProperties().setProperty('sessionToken', sessionToken);
        return { success: true, user: { id: userRow[0], name: userRow[1], email: userRow[2] }, token: sessionToken };
      }
    }
    return { success: false, message: 'Invalid credentials.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function isUserLoggedIn() {
  return PropertiesService.getUserProperties().getProperty('sessionToken') !== null;
}

function getClients() {
  if (!isUserLoggedIn()) {
    return { success: false, message: 'Unauthorized' };
  }
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const clients = data.slice(1).map(row => ({
      id: row[0],
      name: row[1],
      email: row[2],
      phone: row[3],
      address: row[4]
    }));
    return clients;
  } catch (e) {
    return [];
  }
}

function addClient(client) {
  if (!isUserLoggedIn()) {
    return { success: false, message: 'Unauthorized' };
  }
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Clients');
    const newId = getNextId(sheet);
    sheet.appendRow([newId, client.name, client.email, client.phone, client.address]);
    return { success: true, id: newId };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getNextId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 1;
  }
  const lastId = sheet.getRange(lastRow, 1).getValue();
  return lastId + 1;
}

function updateClient(client) {
  if (!isUserLoggedIn()) {
    return { success: false, message: 'Unauthorized' };
  }
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex(row => row[0] == client.id);
    if (rowIndex > 0) {
      sheet.getRange(rowIndex + 1, 2, 1, 4).setValues([[client.name, client.email, client.phone, client.address]]);
      return { success: true };
    }
    return { success: false, message: 'Client not found.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function deleteClient(id) {
  if (!isUserLoggedIn()) {
    return { success: false, message: 'Unauthorized' };
  }
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex(row => row[0] == id);
    if (rowIndex > 0) {
      sheet.deleteRow(rowIndex + 1);
      return { success: true };
    }
    return { success: false, message: 'Client not found.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
