function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * DATABASE HELPER
 * Returns the spreadsheet object. Throws an error if the database isn't set up.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('La base de datos no ha sido configurada. Por favor, haz clic en "Configurar Base de Datos" en la interfaz.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

// =================================================================
// CLIENTS API
// =================================================================

function getClients() {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    if (!sheet) return [];
    // Get all data, remove header row, and filter out empty rows
    const data = sheet.getDataRange().getValues();
    data.shift();
    return data.filter(row => row[0]).map(row => ({
      ID: row[0],
      Name: row[1],
      Email: row[2],
      Phone: row[3],
      Address: row[4]
    }));
  } catch (error) {
    return { error: error.message };
  }
}

// =================================================================
// GEMINI API
// =================================================================

function generateEmailDraftFromApi(invoiceData) {
  const { client, hours, total } = invoiceData;
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');

  if (!apiKey) {
    return { error: 'La clave de la API de Gemini no ha sido configurada en las propiedades del script.' };
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

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
      return { text: result.candidates[0].content.parts[0].text };
    } else {
      return { error: 'No se pudo generar el borrador de correo. La respuesta de la API no fue la esperada.' };
    }
  } catch (error) {
    return { error: 'Error al llamar a la API de Gemini: ' + error.message };
  }
}

// =================================================================
// DATABASE SETUP
// =================================================================

function setupDatabase() {
  try {
    // Create a new spreadsheet and get its ID
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();

    // Store the ID in Script Properties
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

    // Set up the "Clients" sheet
    const clientsSheet = spreadsheet.getSheets()[0];
    clientsSheet.setName('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    clientsSheet.setFrozenRows(1);

    // Set up the "Users" sheet
    const usersSheet = spreadsheet.insertSheet('Users');
    usersSheet.appendRow(['ID', 'Email', 'PasswordHash', 'Salt']);
    usersSheet.setFrozenRows(1);

    return { success: true, message: 'Base de datos configurada exitosamente.', spreadsheetId: spreadsheetId };
  } catch (error) {
    return { error: 'Error al configurar la base de datos: ' + error.message };
  }
}

function addClient(clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const newId = Utilities.getUuid();
    sheet.appendRow([
      newId,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ]);
    return {
        ID: newId,
        Name: clientData.name,
        Email: clientData.email,
        Phone: clientData.phone,
        Address: clientData.address
    };
  } catch (error) {
    return { error: error.message };
  }
}

function updateClient(clientId, clientData) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex(row => row[0] === clientId);

    if (rowIndex > 0) {
      sheet.getRange(rowIndex + 1, 2, 1, 4).setValues([[
        clientData.name,
        clientData.email,
        clientData.phone,
        clientData.address
      ]]);
      return { success: true };
    }
    return { error: 'Cliente no encontrado.' };
  } catch (error) {
    return { error: error.message };
  }
}

function deleteClient(clientId) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex(row => row[0] === clientId);

    if (rowIndex > 0) {
      sheet.deleteRow(rowIndex + 1);
      return { success: true };
    }
    return { error: 'Cliente no encontrado.' };
  } catch (error) {
    return { error: error.message };
  }
}
