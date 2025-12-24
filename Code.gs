function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName('Users');
  const clientsSheet = ss.getSheetByName('Clients');

  if (!usersSheet) {
    const sheet = ss.insertSheet('Users');
    sheet.appendRow(['ID', 'Username', 'PasswordHash', 'Salt']);
    // Add default admin user
    const salt = generateSalt();
    const passwordHash = hashPassword('admin', salt);
    sheet.appendRow([1, 'admin', passwordHash, salt]);
  }

  if (!clientsSheet) {
    const sheet = ss.insertSheet('Clients');
    sheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  }

  return 'Setup Complete. Sheets "Users" and "Clients" are ready.';
}

function generateSalt() {
  const salt = [];
  for (let i = 0; i < 16; i++) {
    salt.push(Math.floor(Math.random() * 256));
  }
  return Utilities.base64Encode(salt);
}

function hashPassword(password, salt) {
  const saltBytes = Utilities.base64Decode(salt);
  const passwordBytes = Utilities.newBlob(password).getBytes();
  const combined = saltBytes.concat(passwordBytes);
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, combined);
  return Utilities.base64Encode(hash);
}

function login(username, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName('Users');

  if (!usersSheet) {
    return { success: false, message: 'User sheet not found. Please run setup.' };
  }

  const data = usersSheet.getDataRange().getValues();
  // Find user by username (assuming username is in the 2nd column, index 1)
  const userRow = data.find(row => row[1] === username);

  if (userRow) {
    const storedHash = userRow[2];
    const salt = userRow[3];
    const inputHash = hashPassword(password, salt);

    if (inputHash === storedHash) {
      return { success: true };
    }
  }

  return { success: false, message: 'Invalid username or password.' };
}

function getClients() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const clientsSheet = ss.getSheetByName('Clients');
  if (!clientsSheet) return [];

  const data = clientsSheet.getDataRange().getValues();
  const headers = data.shift(); // Remove header row

  return data.map(row => {
    let client = {};
    headers.forEach((header, i) => {
      client[header.toLowerCase()] = row[i];
    });
    return client;
  });
}

function getNewId_(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) { // Only header exists or sheet is empty
        return 1;
    }
    // Get IDs from the second row to the last row
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    const numericIds = ids.filter(id => typeof id === 'number');
    return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
}

function addClient(clientData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const clientsSheet = ss.getSheetByName('Clients');
  const newId = getNewId_(clientsSheet);
  clientsSheet.appendRow([
    newId,
    clientData.name,
    clientData.email,
    clientData.phone,
    clientData.address
  ]);
  return { ...clientData, id: newId };
}

function updateClient(clientData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const clientsSheet = ss.getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == clientData.id);

  if (rowIndex > 0) {
    const range = clientsSheet.getRange(rowIndex + 1, 1, 1, 5);
    range.setValues([[
      clientData.id,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ]]);
    return { success: true };
  }
  return { success: false, message: 'Client not found.' };
}

// Helper function for admin to set the API key via the Apps Script editor
function setGeminiApiKey(apiKey) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
}

function generateEmailDraft(invoiceData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return { success: false, message: "API key not set. Please contact administrator." };
  }

  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.name} y su correo es ${client.email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{ "text": prompt }]
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
    if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0]) {
      const text = result.candidates[0].content.parts[0].text;
      return { success: true, draft: text };
    }
    return { success: false, message: 'Could not parse Gemini response.' };
  } catch (e) {
    return { success: false, message: `Error calling Gemini API: ${e.toString()}` };
  }
}

function deleteClient(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const clientsSheet = ss.getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == id);

  if (rowIndex > 0) {
    clientsSheet.deleteRow(rowIndex + 1);
    return { success: true };
  }
  return { success: false, message: 'Client not found.' };
}
