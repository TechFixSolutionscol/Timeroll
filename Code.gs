const SESSION_TIMEOUT_SECONDS = 30 * 60; // 30 minutos

function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('TimeBill Pro')
      .addItem('Configurar Base de Datos', 'setupDatabase')
      .addSeparator()
      .addItem('Establecer Clave de API de Gemini', 'setGeminiApiKey')
      .addToUi();
}

function setGeminiApiKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Establecer Clave de API de Gemini',
    'Por favor, introduce tu clave de API de Google Gemini:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() == ui.Button.OK) {
    const apiKey = response.getResponseText();
    if (apiKey) {
      PropertiesService.getScriptProperties().setProperty('geminiApiKey', apiKey);
      ui.alert('Clave de API de Gemini guardada con éxito.');
    } else {
      ui.alert('No se ha introducido ninguna clave.');
    }
  }
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const requiredSheets = ['Usuarios', 'Clientes'];
  requiredSheets.forEach(sheetName => {
    if (!ss.getSheetByName(sheetName)) {
      ss.insertSheet(sheetName);
      ui.alert(`Hoja '${sheetName}' creada.`);
    }
  });

  const usersSheet = ss.getSheetByName('Usuarios');
  if (usersSheet.getLastRow() === 0) {
    usersSheet.appendRow(['Usuario', 'PasswordHash']);
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, tempPassword);
    const passwordHashStr = passwordHash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
    usersSheet.appendRow(['admin', passwordHashStr]);
    ui.alert(`Usuario 'admin' creado. Contraseña temporal: ${tempPassword}\nPor favor, cámbiala lo antes posible.`);
  }

  const clientsSheet = ss.getSheetByName('Clientes');
  if (clientsSheet.getLastRow() === 0) {
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    clientsSheet.appendRow([1, 'Cliente de Ejemplo S.A.S', 'ejemplo@correo.com', '3001234567', 'Calle Falsa 123']);
    ui.alert('Cliente de ejemplo creado.');
  }

  PropertiesService.getScriptProperties().setProperty('spreadsheetId', ss.getId());
  ui.alert('ID de la hoja de cálculo guardado en las propiedades del script.');
}

function doGet() {
  if (checkAuth()) {
    return HtmlService.createTemplateFromFile('index').evaluate()
        .setTitle('TimeBill Pro')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } else {
    return HtmlService.createTemplateFromFile('Login').evaluate()
        .setTitle('TimeBill Pro - Iniciar Sesión')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function checkAuth() {
  const userProperties = PropertiesService.getUserProperties();
  const session = userProperties.getProperty('session');
  if (!session) return false;

  const sessionData = JSON.parse(session);
  const now = new Date().getTime();

  if (now - sessionData.timestamp > SESSION_TIMEOUT_SECONDS * 1000) {
    userProperties.deleteProperty('session');
    return false;
  }

  // Refresh timestamp
  sessionData.timestamp = now;
  userProperties.setProperty('session', JSON.stringify(sessionData));

  return true;
}

function login(username, password) {
  try {
    const ss = getSpreadsheet();
    const usersSheet = ss.getSheetByName('Usuarios');
    const data = usersSheet.getDataRange().getValues();

    const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password)
                                .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === username && data[i][1] === passwordHash) {
        const userProperties = PropertiesService.getUserProperties();
        const sessionData = {
          user: username,
          timestamp: new Date().getTime()
        };
        userProperties.setProperty('session', JSON.stringify(sessionData));
        return { success: true, user: username };
      }
    }
    return { success: false, message: 'Usuario o contraseña incorrectos.' };
  } catch (e) {
    return { success: false, message: 'Error en el servidor: ' + e.message };
  }
}

function logout() {
  PropertiesService.getUserProperties().deleteProperty('session');
  return { success: true };
}

function getCurrentUser() {
  if (checkAuth()) {
    const userProperties = PropertiesService.getUserProperties();
    const session = JSON.parse(userProperties.getProperty('session'));
    return { user: session.user };
  }
  return { user: null };
}

function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('ID de la hoja de cálculo no configurado. Ejecuta la configuración del menú primero.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

function getClients() {
  try {
    const sheet = getSheet('Clientes');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    if (data.length === 0) {
      return [];
    }

    const clients = data.map(row => {
      let client = {};
      headers.forEach((header, index) => {
        client[header] = row[index];
      });
      return client;
    });
    return clients;
  } catch (e) {
    return [];
  }
}

function addClient(client) {
  try {
    const sheet = getSheet('Clientes');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(header => client[header] || "");

    const idColumn = headers.indexOf('ID') + 1;
    const lastId = sheet.getRange(2, idColumn, sheet.getLastRow(), 1).getValues()
        .reduce((max, row) => Math.max(max, row[0] || 0), 0);
    newRow[idColumn - 1] = lastId + 1;
    client.ID = lastId + 1;

    sheet.appendRow(newRow);
    return { success: true, client: client };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function updateClient(client) {
  try {
    const sheet = getSheet('Clientes');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const idColumnIndex = headers.indexOf('ID');

    for (let i = 0; i < data.length; i++) {
      if (data[i][idColumnIndex] == client.ID) {
        const newRow = headers.map(header => client[header] || "");
        sheet.getRange(i + 2, 1, 1, newRow.length).setValues([newRow]);
        return { success: true, client: client };
      }
    }
    return { success: false, message: 'Cliente no encontrado' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function deleteClient(id) {
  try {
    const sheet = getSheet('Clientes');
    const data = sheet.getDataRange().getValues();
    const idColumnIndex = data[0].indexOf('ID');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumnIndex] == id) {
        sheet.deleteRow(i + 1);
        return { success: true, id: id };
      }
    }
    return { success: false, message: 'Cliente no encontrado' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function generateEmailDraft(invoiceData) {
    const { client, hours, total } = invoiceData;
    const geminiApiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');

    if (!geminiApiKey) {
        return { success: false, message: "La clave de API de Gemini no está configurada en las propiedades del script." };
    }

    // Sanitize inputs by removing characters that aren't letters, numbers, spaces, or common email characters.
    const sanitizedClientName = String(client.Name).replace(/[^a-zA-Z0-9 .'-]/g, '');
    const sanitizedClientEmail = String(client.Email).replace(/[^a-zA-Z0-9 .@_-]/g, '');

    const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${sanitizedClientName} y su correo es ${sanitizedClientEmail}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

    try {
        const requestBody = {
            "contents": [{
                "parts": [{ "text": prompt }]
            }]
        };

        const options = {
            'method': 'post',
            'contentType': 'application/json',
            'payload': JSON.stringify(requestBody)
        };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`;
        const response = UrlFetchApp.fetch(url, options);
        const result = JSON.parse(response.getContentText());

        if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            return { success: true, draft: text };
        } else {
             return { success: false, message: 'No se pudo generar el borrador de correo. La respuesta de la API no tuvo el formato esperado.' };
        }
    } catch (error) {
        return { success: false, message: 'Error al llamar a la API de Gemini: ' + error.toString() };
    }
}
