function doGet() {
  return HtmlService.createTemplateFromFile('templates/index')
      .evaluate()
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setupDatabase() {
  try {
    const sheet = SpreadsheetApp.create('TimeBill Pro Database');
    const sheetId = sheet.getId();

    PropertiesService.getScriptProperties().setProperty('spreadsheetId', sheetId);

    sheet.insertSheet('Clients');
    const clientsSheet = sheet.getSheetByName('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);

    sheet.insertSheet('Users');
    const usersSheet = sheet.getSheetByName('Users');
    usersSheet.appendRow(['ID', 'Username', 'PasswordHash', 'Salt']);

    sheet.deleteSheet(sheet.getSheetByName('Sheet1'));

    return { success: true, message: `Database created successfully. Sheet ID: ${sheetId}` };
  } catch (e) {
    return { success: false, message: `Error creating database: ${e.message}` };
  }
}

function getSheet(sheetName) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not set up. Please run setupDatabase().');
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found.`);
  }
  return sheet;
}

function getClients() {
  try {
    const sheet = getSheet('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header row
    const clients = data.map(row => {
      const client = {};
      headers.forEach((header, index) => {
        client[header] = row[index];
      });
      return client;
    });
    return { success: true, data: clients };
  } catch (e) {
    return { success: false, message: `Error getting clients: ${e.message}` };
  }
}

function addClient(clientData) {
  try {
    const sheet = getSheet('Clients');
    const newId = Utilities.getUuid();
    const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];
    sheet.appendRow(newRow);
    clientData.ID = newId;
    return { success: true, data: clientData };
  } catch (e) {
    return { success: false, message: `Error adding client: ${e.message}` };
  }
}

function updateClient(clientData) {
  try {
    const sheet = getSheet('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColumnIndex = headers.indexOf('ID');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumnIndex] == clientData.ID) {
        const rowToUpdate = i + 1;
        sheet.getRange(rowToUpdate, 1, 1, 5).setValues([[clientData.ID, clientData.name, clientData.email, clientData.phone, clientData.address]]);
        return { success: true, data: clientData };
      }
    }
    return { success: false, message: 'Client not found.' };
  } catch (e) {
    return { success: false, message: `Error updating client: ${e.message}` };
  }
}

function deleteClient(clientId) {
  try {
    const sheet = getSheet('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColumnIndex = headers.indexOf('ID');

    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][idColumnIndex] == clientId) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Client deleted successfully.' };
      }
    }
    return { success: false, message: 'Client not found.' };
  } catch (e) {
    return { success: false, message: `Error deleting client: ${e.message}` };
  }
}

function registerUser(username, password) {
  try {
    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameIndex = headers.indexOf('Username');

    // Check if user already exists
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameIndex] === username) {
        return { success: false, message: 'User already exists.' };
      }
    }

    const salt = Utilities.getUuid();
    const passwordHash = sha256_core(password + salt);
    const newId = Utilities.getUuid();
    sheet.appendRow([newId, username, passwordHash, salt]);
    return { success: true, message: 'User registered successfully.' };
  } catch (e) {
    return { success: false, message: `Error registering user: ${e.message}` };
  }
}

function login(username, password) {
  try {
    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const usernameIndex = headers.indexOf('Username');
    const passwordHashIndex = headers.indexOf('PasswordHash');
    const saltIndex = headers.indexOf('Salt');

    for (let i = 0; i < data.length; i++) {
      if (data[i][usernameIndex] === username) {
        const salt = data[i][saltIndex];
        const passwordHash = sha256_core(password + salt);
        if (passwordHash === data[i][passwordHashIndex]) {
          return { success: true, message: 'Login successful.' };
        }
      }
    }
    return { success: false, message: 'Invalid username or password.' };
  } catch (e) {
    return { success: false, message: `Error during login: ${e.message}` };
  }
}

function generateEmailDraft(invoiceData) {
  const { client, hours, total } = invoiceData;
  const geminiApiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');

  if (!geminiApiKey) {
    return { success: false, message: 'Gemini API key not set up in Script Properties.' };
  }

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.name} y su correo es ${client.email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  try {
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

    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      const text = result.candidates[0].content.parts[0].text;
      return { success: true, data: text };
    } else {
      return { success: false, message: 'Could not generate email draft from API response.' , full_response: result};
    }
  } catch (error) {
    return { success: false, message: `Error calling Gemini API: ${error.toString()}` };
  }
}
