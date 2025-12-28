const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const DB = SpreadsheetApp.openById(SPREADSHEET_ID);
const SHEET_CLIENTS = DB.getSheetByName('Clients');
const SHEET_USERS = DB.getSheetByName('Users');

// --- User Authentication ---

function isAuthenticated() {
    return !!PropertiesService.getUserProperties().getProperty('userId');
}

function generateSalt() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function hashPassword(password, salt) {
  const saltedPassword = password + salt;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, saltedPassword);
  return Utilities.base64Encode(digest);
}

function signUp(name, email, password) {
  const salt = generateSalt();
  const hashedPassword = hashPassword(password, salt);
  const userId = Utilities.getUuid();

  SHEET_USERS.appendRow([userId, name, email, hashedPassword, salt]);

  PropertiesService.getUserProperties().setProperty('userId', userId);

  return { id: userId, name: name, email: email };
}

function signIn(email, password) {
  const data = SHEET_USERS.getDataRange().getValues();
  data.shift();

  for (const row of data) {
    const userId = row[0];
    const name = row[1];
    const userEmail = row[2];
    const hashedPassword = row[3];
    const salt = row[4];

    if (userEmail === email && hashPassword(password, salt) === hashedPassword) {
      PropertiesService.getUserProperties().setProperty('userId', userId);
      return { id: userId, name: name, email: userEmail };
    }
  }

  throw new Error('Invalid credentials');
}

function checkSession() {
  const userId = PropertiesService.getUserProperties().getProperty('userId');
  if (!userId) return null;

  const data = SHEET_USERS.getDataRange().getValues();
  data.shift();

  for (const row of data) {
    if (row[0] === userId) {
      return { id: row[0], name: row[1], email: row[2] };
    }
  }

  return null;
}

function logout() {
  PropertiesService.getUserProperties().deleteProperty('userId');
}


// --- Main App Logic ---

function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setViewportContent('width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getClients() {
  if (!isAuthenticated()) throw new Error('Not authenticated');
  const data = SHEET_CLIENTS.getDataRange().getValues();
  data.shift();

  const clients = data.map(row => ({
    id: row[0], name: row[1], email: row[2], phone: row[3], address: row[4]
  }));

  return clients;
}

function addClient(clientData) {
  if (!isAuthenticated()) throw new Error('Not authenticated');
  const newId = Utilities.getUuid();
  SHEET_CLIENTS.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
  return getClients();
}

function editClient(clientData) {
  if (!isAuthenticated()) throw new Error('Not authenticated');
  const data = SHEET_CLIENTS.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('ID');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] == clientData.id) {
      SHEET_CLIENTS.getRange(i + 1, 1, 1, 5).setValues([[
        clientData.id, clientData.name, clientData.email, clientData.phone, clientData.address
      ]]);
      return getClients();
    }
  }

  throw new Error('Client not found');
}

function deleteClient(clientId) {
  if (!isAuthenticated()) throw new Error('Not authenticated');
  const data = SHEET_CLIENTS.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('ID');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] == clientId) {
      SHEET_CLIENTS.deleteRow(i + 1);
      return { success: true };
    }
  }

  throw new Error('Client not found');
}

function generateEmailDraft(invoiceData) {
  if (!isAuthenticated()) throw new Error('Not authenticated');
  const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const { client, hours, total } = invoiceData;

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.name}. El correo debe ser conciso.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

  const requestBody = { contents: [{ parts: [{ text: prompt }] }] };
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(requestBody) };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    if (result.candidates && result.candidates[0].content.parts[0].text) {
      return result.candidates[0].content.parts[0].text;
    }
    throw new Error('Could not generate draft.');
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error('Error generating draft.');
  }
}
