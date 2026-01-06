// The main function that serves the HTML page
function doGet() {
  return HtmlService.createTemplateFromFile('templates/index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// A helper function to include other HTML files (CSS, JS)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Global variable for the spreadsheet ID for easy access
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('spreadsheetId');

/**
 * Sets up the Google Sheet database.
 * Creates a new spreadsheet, sets up the "Clients" and "Users" sheets,
 * and stores the spreadsheet ID in script properties.
 */
function setupDatabase() {
  // Check if the database is already set up to avoid overwriting
  const existingSpreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (existingSpreadsheetId) {
    try {
        // If the sheet exists, we don't need to do anything.
        const existingSheet = SpreadsheetApp.openById(existingSpreadsheetId);
        return { success: true, message: 'La base de datos ya está configurada.', spreadsheetId: existingSpreadsheetId, url: existingSheet.getUrl() };
    } catch (e) {
        // The sheet might have been deleted, so we proceed with setup.
    }
  }

  // Create a new spreadsheet and name it
  const spreadsheet = SpreadsheetApp.create('TimeBillProDB');
  const spreadsheetId = spreadsheet.getId();

  // Store the new spreadsheet ID in script properties
  PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

  // Get the default sheet and rename it to "Clients"
  const clientsSheet = spreadsheet.getSheets()[0];
  clientsSheet.setName('Clients');
  // Set the headers for the "Clients" sheet
  clientsSheet.getRange('A1:E1').setValues([['ID', 'Name', 'Email', 'Phone', 'Address']]);

  // Create a "Users" sheet and set its headers
  const usersSheet = spreadsheet.insertSheet('Users');
  usersSheet.getRange('A1:C1').setValues([['ID', 'Username', 'PasswordHash']]);

  // Return a success message with the new sheet's URL
  return {
    success: true,
    message: 'Base de datos configurada exitosamente.',
    spreadsheetId: spreadsheetId,
    url: spreadsheet.getUrl()
  };
}

/**
 * Retrieves the client list from the spreadsheet.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header row
    return data.map(row => {
      const client = {};
      headers.forEach((header, i) => {
        client[header] = row[i];
      });
      return client;
    });
  } catch (e) {
    console.error('Error getting clients:', e);
    return []; // Return empty array on error
  }
}

/**
 * Adds a new client to the spreadsheet.
 * @param {Object} clientData - The client data to add.
 * @returns {Object} The client data that was added, including the new ID.
 */
function addClient(clientData) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Clients');
    const newId = Utilities.getUuid(); // Generate a unique ID
    sheet.appendRow([
      newId,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ]);
    return { ...clientData, ID: newId }; // Return the full client object
  } catch (e) {
    console.error('Error adding client:', e);
    throw new Error('No se pudo añadir el cliente.');
  }
}

/**
 * Updates an existing client in the spreadsheet.
 * @param {Object} clientData - The client data to update, must include ID.
 * @returns {Object} The updated client data.
 */
function updateClient(clientData) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const idIndex = headers.indexOf('ID');

    for (let i = 0; i < data.length; i++) {
      if (data[i][idIndex] == clientData.ID) {
        // Update the row with new data
        sheet.getRange(i + 2, 1, 1, headers.length).setValues([[
          clientData.ID,
          clientData.name,
          clientData.email,
          clientData.phone,
          clientData.address
        ]]);
        return clientData;
      }
    }
    throw new Error('Cliente no encontrado.');
  } catch (e) {
    console.error('Error updating client:', e);
    throw new Error('No se pudo actualizar el cliente.');
  }
}

/**
 * Deletes a client from the spreadsheet.
 * @param {string} clientId - The ID of the client to delete.
 * @returns {Object} A success status object.
 */
function deleteClient(clientId) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const idIndex = headers.indexOf('ID');

    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][idIndex] == clientId) {
        sheet.deleteRow(i + 2); // Delete the corresponding row
        return { success: true };
      }
    }
    throw new Error('Cliente no encontrado.');
  } catch (e) {
    console.error('Error deleting client:', e);
    throw new Error('No se pudo eliminar el cliente.');
  }
}

/**
 * Generates an email draft using the Gemini API.
 * The API call is made from the backend to keep the API key secure.
 * @param {Object} invoiceData - Data for the invoice (client, hours, total).
 * @returns {string} The generated email draft text.
 */
function generateEmailDraft(invoiceData) {
    const { client, hours, total } = invoiceData;
    const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');

    if (!apiKey) {
        throw new Error("La clave de API de Gemini no está configurada.");
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

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
        payload: JSON.stringify(payload),
        muteHttpExceptions: true // Important to see error messages
    };

    try {
        const response = UrlFetchApp.fetch(apiUrl, options);
        const result = JSON.parse(response.getContentText());

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            return result.candidates[0].content.parts[0].text;
        } else {
            console.error('Respuesta inesperada de la API:', result);
            return 'No se pudo generar el borrador de correo. La respuesta de la API fue inválida.';
        }
    } catch (error) {
        console.error('Error al llamar a la API de Gemini:', error.toString());
        return `Error al generar el borrador: ${error.message}`;
    }
}
