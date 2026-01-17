/**
 * @OnlyCurrentDoc
 *
 * The above comment directs App Script to limit the scope of script authorization
 * to only the current document. This is a best practice for security.
 */

// ===============================================================================================
// SERVING THE FRONTEND
// ===============================================================================================

/**
 * Serves the HTML of the web app.
 * This is the entry point for the web app.
 *
 * @param {Object} e The event parameter for a simple get request.
 * @return {HtmlOutput} The HTML to be served.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Includes an HTML file in another HTML file.
 * This is a helper function to modularize the HTML.
 *
 * @param {string} filename The name of the file to be included.
 * @return {string} The content of the HTML file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===============================================================================================
// DATABASE HELPERS
// ===============================================================================================

/**
 * Gets the active spreadsheet.
 * Throws an error if the database is not set up.
 * @return {Spreadsheet} The active spreadsheet.
 */
function getSpreadsheet() {
  const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!SPREADSHEET_ID) {
    throw new Error('La base de datos no ha sido configurada. Por favor, ejecute la función "setupDatabase" desde el editor de Apps Script.');
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Gets a specific sheet by name from the active spreadsheet.
 * @param {string} sheetName The name of the sheet to get.
 * @return {Sheet} The sheet object.
 */
function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}

/**
 * Converts a sheet's data to an array of objects.
 * Assumes the first row is the header.
 * @param {Sheet} sheet The sheet to convert.
 * @return {Array<Object>} The array of objects.
 */
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map((row, index) => {
    return headers.reduce((obj, header, i) => {
      obj[header] = row[i];
      obj.rowIndex = index + 2; // Store original row index for updates
      return obj;
    }, {});
  });
}


// ===============================================================================================
// DATABASE SETUP
// ===============================================================================================

/**
 * Sets up the Google Sheet database.
 * Creates a new spreadsheet with "Clients" and "Users" sheets.
 * Stores the spreadsheet ID in the script properties.
 * This function should be run manually from the Apps Script editor.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.create('TimeBillPro_DB');
  PropertiesService.getScriptProperties().setProperty('spreadsheetId', ss.getId());

  const clientsSheet = ss.getSheetByName('Sheet1');
  clientsSheet.setName('Clients');
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  clientsSheet.getRange('A1:E1').setFontWeight('bold');

  const usersSheet = ss.insertSheet('Users');
  usersSheet.appendRow(['ID', 'Username', 'Role']);
  usersSheet.getRange('A1:C1').setFontWeight('bold');
  usersSheet.appendRow([1, 'professional', 'Admin']);

  Logger.log(`Base de datos creada. ID de la hoja de cálculo: ${ss.getId()}`);
  Browser.msgBox('¡Base de datos configurada!', 'La hoja de cálculo de Google se ha creado y configurado correctamente.', Browser.Buttons.OK);
}


// ===============================================================================================
// CLIENT MANAGEMENT (CRUD OPERATIONS)
// ===============================================================================================

/**
 * Retrieves all clients from the Google Sheet.
 * @return {Array<Object>} An array of client objects.
 */
function getClients() {
  try {
    const clientsSheet = getSheet('Clients');
    return sheetToObjects(clientsSheet);
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Adds a new client to the Google Sheet.
 * @param {Object} client The client object to add.
 * @return {Object} The added client object.
 */
function addClient(client) {
  try {
    const clientsSheet = getSheet('Clients');
    const newId = (clientsSheet.getLastRow() > 1 ? Math.max(...clientsSheet.getRange('A2:A').getValues().flat().filter(id => id)) : 0) + 1;

    const newRow = [
      newId,
      client.name,
      client.email,
      client.phone,
      client.address
    ];
    clientsSheet.appendRow(newRow);

    return { ID: newId, ...client };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Updates an existing client in the Google Sheet.
 * @param {Object} client The client object to update. It must have a 'rowIndex' property.
 * @return {Object} The updated client object.
 */
function updateClient(client) {
  try {
    const clientsSheet = getSheet('Clients');
    const data = sheetToObjects(clientsSheet);
    const clientToUpdate = data.find(c => c.ID == client.id);

    if (!clientToUpdate) {
        throw new Error("Client not found for updating.");
    }

    const rowIndex = clientToUpdate.rowIndex;

    // Update Name, Email, Phone, Address - Assumes headers are in order
    clientsSheet.getRange(rowIndex, 2, 1, 4).setValues([[
        client.name,
        client.email,
        client.phone,
        client.address
    ]]);

    return client;
  } catch (e) {
    return { error: e.message };
  }
}


/**
 * Deletes a client from the Google Sheet.
 * @param {number} clientId The ID of the client to delete.
 * @return {Object} A success or error message.
 */
function deleteClient(clientId) {
  try {
    const clientsSheet = getSheet('Clients');
    const data = sheetToObjects(clientsSheet);
    const clientToDelete = data.find(c => c.ID == clientId);

    if (clientToDelete) {
        clientsSheet.deleteRow(clientToDelete.rowIndex);
        return { success: true };
    } else {
        throw new Error('Client not found for deletion.');
    }
  } catch (e) {
    return { error: e.message };
  }
}


// ===============================================================================================
// GEMINI API INTEGRATION
// ===============================================================================================

/**
 * Generates an email draft using the Gemini API.
 * @param {string} prompt The prompt to send to the Gemini API.
 * @return {string} The generated email draft or an error message.
 */
function generateEmailDraft(prompt) {
    const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
    if (!GEMINI_API_KEY) {
        return 'Error: La clave de la API de Gemini no está configurada en las Propiedades del Script.';
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

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

    try {
        const response = UrlFetchApp.fetch(API_URL, options);
        const responseData = JSON.parse(response.getContentText());

        if (response.getResponseCode() === 200 && responseData.candidates && responseData.candidates.length > 0) {
            return responseData.candidates[0].content.parts[0].text;
        } else {
            Logger.log('Error en la respuesta de la API de Gemini: ' + response.getContentText());
            return 'Error: No se pudo generar el borrador del correo. ' + (responseData.error ? responseData.error.message : 'Respuesta inválida de la API.');
        }
    } catch (error) {
        Logger.log('Error al llamar a la API de Gemini: ' + error.toString());
        return 'Error: Ocurrió un problema al contactar el servicio de IA.';
    }
}
