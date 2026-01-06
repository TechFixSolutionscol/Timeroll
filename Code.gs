function doGet() {
  return HtmlService.createTemplateFromFile('templates/index').evaluate()
      .setTitle('TimeBill Pro')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(`templates/${filename}`).getContent();
}

function setupDatabase() {
  try {
    const sheet = SpreadsheetApp.create('TimeBill Pro Database');
    const sheetId = sheet.getId();
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', sheetId);

    const usersSheet = sheet.insertSheet('Users');
    usersSheet.appendRow(['ID', 'Username', 'PasswordHash']);
    // Add a default user for testing
    usersSheet.appendRow([Utilities.getUuid(), 'admin', hashPassword('admin')]);

    const clientsSheet = sheet.insertSheet('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);

    SpreadsheetApp.openById(sheetId).deleteSheet(sheet.getSheetByName('Sheet1'));

    return { success: true, message: `Database created successfully. Sheet ID: ${sheetId}` };
  } catch (e) {
    return { success: false, message: `Error setting up database: ${e.message}` };
  }
}

function hashPassword(password) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

function login(username, password) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    return { success: false, message: "Database not set up. Please click 'Setup Database'." };
  }
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const passwordHash = hashPassword(password);

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username && data[i][2] === passwordHash) {
      return { success: true, user: { username: data[i][1] } };
    }
  }
  return { success: false, message: 'Invalid username or password.' };
}

function getClients() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
   if (!spreadsheetId) return [];
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const clients = [];
  for (let i = 1; i < data.length; i++) {
    clients.push({
      ID: data[i][0],
      Name: data[i][1],
      Email: data[i][2],
      Phone: data[i][3],
      Address: data[i][4],
    });
  }
  return clients;
}

function addClient(clientData) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Clients');
  const newId = Utilities.getUuid();
  sheet.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
  return { ID: newId, Name: clientData.name, Email: clientData.email, Phone: clientData.phone, Address: clientData.address };
}

function updateClient(clientData) {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === clientData.id) {
            sheet.getRange(i + 1, 2).setValue(clientData.name);
            sheet.getRange(i + 1, 3).setValue(clientData.email);
            sheet.getRange(i + 1, 4).setValue(clientData.phone);
            sheet.getRange(i + 1, 5).setValue(clientData.address);
            return { success: true, message: 'Client updated successfully.' };
        }
    }
    return { success: false, message: 'Client not found.' };
}

function deleteClient(clientId) {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === clientId) {
            sheet.deleteRow(i + 1);
            return { success: true, message: 'Client deleted successfully.' };
        }
    }
    return { success: false, message: 'Client not found.' };
}

function generateEmailDraft(invoiceData) {
  const geminiApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!geminiApiKey) {
    return { success: false, message: "GEMINI_API_KEY not configured in Script Properties." };
  }

  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
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
      return { success: false, message: "Could not generate email draft from API response." };
    }
  } catch (e) {
    return { success: false, message: `Error calling Gemini API: ${e.message}` };
  }
}
