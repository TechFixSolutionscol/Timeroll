function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// IMPORTANT: To use the email generation feature, you must store your Gemini API key in the script's properties.
// 1. In the Apps Script editor, go to "Project Settings" (the gear icon on the left).
// 2. Scroll down to "Script Properties" and click "Add script property".
// 3. Set the "Property" to "geminiApiKey" and the "Value" to your actual Gemini API key.
// 4. Click "Save script properties".

function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('El ID de la hoja de cálculo no está configurado. Por favor, ejecuta la configuración inicial.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function setupDatabase() {
  const spreadsheet = SpreadsheetApp.create('TimeBill Pro DB');
  PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheet.getId());

  spreadsheet.insertSheet('Clients');
  const clientsSheet = spreadsheet.getSheetByName('Clients');
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);

  spreadsheet.insertSheet('Users');
  const usersSheet = spreadsheet.getSheetByName('Users');
  usersSheet.appendRow(['ID', 'Email', 'PasswordHash', 'Salt']);

  // Delete the default "Sheet1"
  const defaultSheet = spreadsheet.getSheetByName('Sheet1');
  if (defaultSheet) {
    spreadsheet.deleteSheet(defaultSheet);
  }

  return { success: true, message: 'Base de datos configurada exitosamente!', spreadsheetId: spreadsheet.getId() };
}

function getClients() {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header row
    const clients = data.map(row => {
      let client = {};
      headers.forEach((header, i) => {
        client[header] = row[i];
      });
      return client;
    });
    return JSON.stringify(clients);
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}

function addClient(clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const newId = Utilities.getUuid();
    sheet.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
    clientData.ID = newId; // Return the new ID to the client
    return JSON.stringify({ success: true, client: clientData });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

function registerUser(credentials) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Users');
    const salt = generateSalt();
    const passwordHash = hashPassword(credentials.password, salt);
    const newId = Utilities.getUuid();

    sheet.appendRow([newId, credentials.email, passwordHash, salt]);

    return JSON.stringify({ success: true });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

function loginUser(credentials) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header row
    const emailIndex = headers.indexOf('Email');
    const hashIndex = headers.indexOf('PasswordHash');
    const saltIndex = headers.indexOf('Salt');

    for (let i = 0; i < data.length; i++) {
      if (data[i][emailIndex] === credentials.email) {
        const storedHash = data[i][hashIndex];
        const salt = data[i][saltIndex];
        const enteredHash = hashPassword(credentials.password, salt);

        if (storedHash === enteredHash) {
          return JSON.stringify({ success: true, user: { email: credentials.email } });
        } else {
          return JSON.stringify({ success: false, message: 'Contraseña incorrecta.' });
        }
      }
    }
    return JSON.stringify({ success: false, message: 'Usuario no encontrado.' });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

function updateClient(clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColumnIndex = headers.indexOf('ID');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumnIndex] == clientData.ID) {
        // Found the row, now update it
        let newRow = headers.map(header => clientData[header] || '');
        sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
        return JSON.stringify({ success: true, client: clientData });
      }
    }
    return JSON.stringify({ success: false, message: 'Cliente no encontrado' });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

function deleteClient(clientId) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const idColumnIndex = data[0].indexOf('ID');

    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][idColumnIndex] == clientId) {
        sheet.deleteRow(i + 1);
        return JSON.stringify({ success: true });
      }
    }
    return JSON.stringify({ success: false, message: 'Cliente no encontrado' });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}


function generateEmailDraft(invoiceData) {
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
    if (!apiKey) {
      return JSON.stringify({ success: false, message: 'La API key de Gemini no está configurada.' });
    }

    const { client, hours, total } = invoiceData;
    const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

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
      payload: JSON.stringify(payload)
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      const text = result.candidates[0].content.parts[0].text;
      return JSON.stringify({ success: true, draft: text });
    } else {
      return JSON.stringify({ success: false, message: 'No se pudo generar el borrador del correo.' });
    }
  } catch (error) {
    Logger.log('Error al llamar a la API de Gemini: ' + error.toString());
    return JSON.stringify({ success: false, message: 'Error al generar el borrador. Por favor, revisa la conexión y la configuración.' });
  }
}
