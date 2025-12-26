// ===============================================
// Configuración
// ===============================================

/**
 * EJECUTA ESTA FUNCIÓN MANUALMENTE DESDE EL EDITOR DE APPS SCRIPT PARA CONFIGURAR LA APLICACIÓN.
 * RELLENA TU SPREADSHEET_ID Y TU GEMINI_API_KEY ABAJO.
 */
function setup() {
  const spreadsheetId = 'YOUR_SPREADSHEET_ID_HERE'; // Pega tu ID de Hoja de Cálculo aquí
  const geminiApiKey = 'YOUR_GEMINI_API_KEY_HERE';  // Pega tu clave de API de Gemini aquí

  if (spreadsheetId === 'YOUR_SPREADSHEET_ID_HERE' || geminiApiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    Logger.log('Por favor, reemplaza los valores de marcador de posición en la función setup() antes de ejecutar.');
    return;
  }

  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('SPREADSHEET_ID', spreadsheetId);
  properties.setProperty('GEMINI_API_KEY', geminiApiKey);

  // Inicializa la hoja si no existe
  try {
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Clients');
    if (!sheet) {
      const newSheet = SpreadsheetApp.openById(spreadsheetId).insertSheet('Clients');
      newSheet.appendRow(['id', 'name', 'email', 'phone', 'address']);
      Logger.log('Hoja "Clients" creada con éxito.');
    }
  } catch (e) {
    Logger.log('Error al acceder a la Hoja de Cálculo. Asegúrate de que el ID es correcto y tienes permiso. Error: ' + e.message);
    return;
  }

  Logger.log('Aplicación configurada con éxito.');
}


// ===============================================
// Lógica Principal de la Aplicación Web
// ===============================================

function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.SAMEORIGIN);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getScriptProperty(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error(`La propiedad requerida "${key}" no está configurada. Por favor, ejecuta la función "setup" desde el editor de Apps Script.`);
  }
  return value;
}

// ===============================================
// API de Clientes (CRUD)
// ===============================================

function getClients() {
  try {
    const spreadsheetId = getScriptProperty('SPREADSHEET_ID');
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const clients = data.map(row => {
      let client = {};
      headers.forEach((header, index) => {
        client[header.toLowerCase()] = row[index];
      });
      return client;
    });

    return clients;
  } catch (e) {
    Logger.log(e);
    return { error: e.message };
  }
}

function getNextId() {
  const spreadsheetId = getScriptProperty('SPREADSHEET_ID');
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Clients');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 1;
  }
  const maxId = sheet.getRange(2, 1, lastRow - 1).getValues()
    .reduce((max, row) => Math.max(max, row[0]), 0);
  return maxId + 1;
}

function addClient(clientData) {
  try {
    const spreadsheetId = getScriptProperty('SPREADSHEET_ID');
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Clients');
    const newId = getNextId();
    clientData.id = newId;
    const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];
    sheet.appendRow(newRow);
    return clientData;
  } catch (e) {
    Logger.log(e);
    return { error: e.message };
  }
}

function updateClient(clientData) {
  try {
    const spreadsheetId = getScriptProperty('SPREADSHEET_ID');
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const rowIndex = data.findIndex(row => row[0] == clientData.id);

    if (rowIndex !== -1) {
      const rowToUpdate = rowIndex + 2;
      const updatedRow = headers.map(header => clientData[header.toLowerCase()]);
      sheet.getRange(rowToUpdate, 1, 1, headers.length).setValues([updatedRow]);
      return clientData;
    } else {
      throw new Error("Cliente no encontrado.");
    }
  } catch (e) {
    Logger.log(e);
    return { error: e.message };
  }
}

function deleteClient(clientId) {
  try {
    const spreadsheetId = getScriptProperty('SPREADSHEET_ID');
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();

    const rowIndex = data.findIndex(row => row[0] == clientId);

    if (rowIndex !== -1) {
      const rowToDelete = rowIndex + 1;
      sheet.deleteRow(rowToDelete);
      return { success: true, id: clientId };
    } else {
      return { success: false, message: "Cliente no encontrado." };
    }
  } catch (e) {
    Logger.log(e);
    return { error: e.message };
  }
}

// ===============================================
// API de Gemini
// ===============================================

function generateEmailDraftBackend(prompt) {
  try {
    const apiKey = getScriptProperty('GEMINI_API_KEY');
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

    if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts[0]) {
      return result.candidates[0].content.parts[0].text;
    } else {
      Logger.log('Respuesta inesperada de la API:', result);
      return { error: 'No se pudo generar el borrador del correo. La respuesta de la API fue inválida.' };
    }
  } catch (e) {
    Logger.log('Error al llamar a la API de Gemini:', e);
    return { error: 'Error al contactar la API de Gemini: ' + e.message };
  }
}