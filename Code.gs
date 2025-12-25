function doGet(e) {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('TimeBill Pro')
      .addItem('Setup', 'setup')
      .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  // Create Users sheet
  let usersSheet = ss.getSheetByName('Users');
  if (!usersSheet) {
    usersSheet = ss.insertSheet('Users');
    usersSheet.getRange('A1:E1').setValues([['ID', 'Username', 'PasswordHash', 'Salt', 'Role']]);

    // Create a default admin user
    const salt = Utilities.getUuid();
    const password = 'admin'; // Default password
    const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt)
                          .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                          .join('');

    usersSheet.getRange('A2:E2').setValues([[1, 'admin', hash, salt, 'admin']]);
    ui.alert('Users sheet created with a default admin user (admin/admin).');
  } else {
    ui.alert('Users sheet already exists.');
  }

  // Create Clients sheet
  let clientsSheet = ss.getSheetByName('Clients');
  if (!clientsSheet) {
    clientsSheet = ss.insertSheet('Clients');
    clientsSheet.getRange('A1:E1').setValues([['ID', 'Name', 'Email', 'Phone', 'Address']]);
    clientsSheet.getRange('A2:E2').setValues([[1, 'Cliente de Ejemplo S.A.S', 'ejemplo@correo.com', '3001234567', 'Calle Falsa 123']]);
    ui.alert('Clients sheet created with an example client.');
  } else {
    ui.alert('Clients sheet already exists.');
  }
}

// =============================================
//               CLIENTS CRUD
// =============================================

function getClients() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Clients');
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data.shift();
    const clients = data.map(row => {
      let client = {};
      headers.forEach((header, i) => {
        client[header.toLowerCase()] = row[i];
      });
      return client;
    });
    return clients;
  } catch (e) {
    Logger.log('Error in getClients: ' + e.toString());
    return [];
  }
}

function getNextId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 1;
  }
  const maxId = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
                   .reduce((max, row) => Math.max(max, row[0]), 0);
  return maxId + 1;
}


function addClient(clientData) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Clients');
    const newId = getNextId(sheet);
    sheet.appendRow([
      newId,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ]);
    clientData.id = newId;
    return { success: true, client: clientData };
  } catch (e) {
    Logger.log('Error in addClient: ' + e.toString());
    return { success: false, message: 'Failed to add client.' };
  }
}

function updateClient(clientData) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('ID');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] == clientData.id) {
        sheet.getRange(i + 1, 1, 1, 5).setValues([[
          clientData.id,
          clientData.name,
          clientData.email,
          clientData.phone,
          clientData.address
        ]]);
        return { success: true, client: clientData };
      }
    }
    return { success: false, message: 'Client not found.' };
  } catch (e) {
    Logger.log('Error in updateClient: ' + e.toString());
    return { success: false, message: 'Failed to update client.' };
  }
}

function deleteClient(id) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const idIndex = data[0].indexOf('ID');

    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][idIndex] == id) {
        sheet.deleteRow(i + 1);
        return { success: true, id: id };
      }
    }
    return { success: false, message: 'Client not found.' };
  } catch (e) {
    Logger.log('Error in deleteClient: ' + e.toString());
    return { success: false, message: 'Failed to delete client.' };
  }
}

// =============================================
//               AUTHENTICATION
// =============================================
function loginUser(username, password) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    if (!sheet) return { success: false, message: 'User sheet not found.' };

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const usernameIndex = headers.indexOf('Username');
    const hashIndex = headers.indexOf('PasswordHash');
    const saltIndex = headers.indexOf('Salt');
    const roleIndex = headers.indexOf('Role');

    for (const row of data) {
      if (row[usernameIndex] === username) {
        const salt = row[saltIndex];
        const storedHash = row[hashIndex];
        const inputHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt)
                                   .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                                   .join('');

        if (inputHash === storedHash) {
          return { success: true, user: { username: row[usernameIndex], role: row[roleIndex] } };
        } else {
          return { success: false, message: 'Invalid password.' };
        }
      }
    }
    return { success: false, message: 'User not found.' };
  } catch (e) {
    Logger.log('Error in loginUser: ' + e.toString());
    return { success: false, message: 'An error occurred during login.' };
  }
}

// =============================================
//               GEMINI API
// =============================================

// Helper function for the admin to set the API key via the script editor
function setGeminiApiKey(apiKey) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
  Logger.log('Gemini API key set successfully.');
}

function generateEmailDraft(invoiceData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return { success: false, message: "API key for Gemini not set. Please ask the administrator to set it." };
  }

  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.name} y su correo es ${client.email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

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

    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0]) {
      const text = result.candidates[0].content.parts[0].text;
      return { success: true, draft: text };
    } else {
      Logger.log('Unexpected Gemini API response format: ' + JSON.stringify(result));
      return { success: false, message: 'Could not generate email draft. Unexpected API response.' };
    }
  } catch (e) {
    Logger.log('Error calling Gemini API: ' + e.toString());
    return { success: false, message: 'An error occurred while generating the email draft.' };
  }
}
