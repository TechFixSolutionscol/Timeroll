// ===================================================================================================
// CONFIGURACIÓN INICIAL (Pasos Manuales)
// ===================================================================================================
// 1. Ejecutar `setupDatabase` manualmente desde el editor de Apps Script UNA VEZ.
//    Esto creará la hoja de cálculo de Google que actuará como base de datos y guardará su ID.
// 2. Configurar la clave de API de Gemini:
//    - En el editor de Apps Script, ve a "Configuración del Proyecto" (icono de engranaje).
//    - En la sección "Propiedades del Script", añade una nueva propiedad.
//    - Nombre de la propiedad: `geminiApiKey`
//    - Valor de la propiedad: Tu clave de API de Gemini.
// ===================================================================================================

const SSID_KEY = 'spreadsheetId';

function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setupDatabase() {
  const ss = SpreadsheetApp.create('TimeBill Pro - Clientes');
  PropertiesService.getScriptProperties().setProperty(SSID_KEY, ss.getId());
  const sheet = ss.getSheets()[0];
  sheet.setName('Clients');
  sheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  sheet.getRange('A1:E1').setFontWeight('bold');
  sheet.setFrozenRows(1);
  console.log(`Base de datos creada. ID de la hoja: ${ss.getId()}`);
  return ss.getId();
}

function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SSID_KEY);
  if (!spreadsheetId) {
    throw new Error('La base de datos no ha sido configurada. Por favor, ejecute la función setupDatabase() desde el editor de Apps Script.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getClients() {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    return data.map(row => {
      let client = {};
      headers.forEach((header, i) => {
        client[header] = row[i];
      });
      return client;
    });
  } catch (e) {
    return { error: e.message };
  }
}

function addClient(clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(header => clientData[header] || '');

    const allIds = sheet.getRange('A2:A').getValues().flat().filter(String);
    const maxId = allIds.length > 0 ? Math.max(...allIds) : 0;
    newRow[0] = maxId + 1;

    sheet.appendRow(newRow);

    clientData.ID = newRow[0];
    return { success: true, client: clientData };
  } catch (e) {
    return { error: e.message };
  }
}

function updateClient(clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const idIndex = headers.indexOf('ID');

    for (let i = 0; i < data.length; i++) {
      if (data[i][idIndex] == clientData.ID) {
        let newRow = headers.map(header => clientData[header] || '');
        sheet.getRange(i + 2, 1, 1, newRow.length).setValues([newRow]);
        return { success: true, client: clientData };
      }
    }
    return { error: 'Cliente no encontrado' };
  } catch (e) {
    return { error: e.message };
  }
}

function deleteClient(clientId) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const idIndex = data[0].indexOf('ID');

    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][idIndex] == clientId) {
        sheet.deleteRow(i + 1);
        return { success: true, deletedId: clientId };
      }
    }
    return { error: 'Cliente no encontrado' };
  } catch (e) {
    return { error: e.message };
  }
}

function generateEmailDraft(prompt) {
    const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
    if (!apiKey) {
        return { error: 'La clave de la API de Gemini no está configurada en las Propiedades del Script.' };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(requestBody),
        muteHttpExceptions: true
    };

    try {
        const response = UrlFetchApp.fetch(apiUrl, options);
        const responseData = JSON.parse(response.getContentText());

        if (response.getResponseCode() === 200) {
            if (responseData.candidates && responseData.candidates.length > 0 &&
                responseData.candidates[0].content && responseData.candidates[0].content.parts &&
                responseData.candidates[0].content.parts.length > 0) {
                return { text: responseData.candidates[0].content.parts[0].text };
            } else {
                 return { error: 'Respuesta inesperada de la API de Gemini.', details: responseData };
            }
        } else {
            return { error: 'Error en la solicitud a la API de Gemini.', details: responseData };
        }
    } catch (e) {
        return { error: e.message };
    }
}
