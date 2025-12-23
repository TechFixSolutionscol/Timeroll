// --- CONFIGURATION ---
const SHEETS = {
  USERS: 'Users',
  CLIENTS: 'Clients',
  INVOICES: 'Invoices'
};

// --- CORE FUNCTIONS ---

/**
 * Serves the HTML of the web application.
 * This function is automatically called when the web app URL is accessed.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Includes the content of other files (like CSS or JS) into the main HTML file.
 * This is a common pattern for structuring Apps Script web apps.
 * @param {string} filename - The name of the file to include (without extension).
 * @returns {string} The content of the specified file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


/**
 * Sets up the spreadsheet with the required sheets if they don't exist.
 * This function can be run manually from the Apps Script editor to initialize the database.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.values(SHEETS).forEach(sheetName => {
    if (!ss.getSheetByName(sheetName)) {
      ss.insertSheet(sheetName);
      // Set headers for the new sheet
      const headers = {
        [SHEETS.USERS]: ['ID', 'Username', 'PasswordHash', 'Salt'],
        [SHEETS.CLIENTS]: ['ID', 'Name', 'Email', 'Phone', 'Address'],
        [SHEETS.INVOICES]: ['ID', 'ClientID', 'StartTime', 'EndTime', 'HourlyRate', 'TotalBilled']
      };
      if (headers[sheetName]) {
        ss.getSheetByName(sheetName).getRange(1, 1, 1, headers[sheetName].length).setValues([headers[sheetName]]);
      }
    }
  });
}

// --- API & DATA FUNCTIONS ---

/**
 * @description Generates a professional and friendly email draft to send an invoice to a client.
 * @param {number} hours - The duration of the session in hours.
 * @param {number} total - The total amount to be paid.
 * @param {string} clientName - The name of the client.
 * @param {string} clientEmail - The email address of the client.
 * @returns {string} The generated email draft or an error message.
 */
function generateEmailDraft(hours, total, clientName, clientEmail) {
    const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
        return "Error: La clave API de Gemini no está configurada en el backend.";
    }

    const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${clientName} y su correo es ${clientEmail}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

    try {
        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }]
        };

        const options = {
            method: 'POST',
            contentType: 'application/json',
            payload: JSON.stringify(payload)
        };

        const response = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, options);
        const result = JSON.parse(response.getContentText());

        if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts[0]) {
            return result.candidates[0].content.parts[0].text;
        } else {
            console.log("Respuesta inesperada de la API:", JSON.stringify(result, null, 2));
            return 'No se pudo generar el borrador. La respuesta de la API fue inesperada.';
        }
    } catch (error) {
        console.error('Error al llamar a la API de Gemini:', error);
        return `Error al generar el borrador: ${error.message}`;
    }
}


/**
 * Helper function to securely store the Gemini API key.
 * To use, run this function manually from the Apps Script editor.
 * @param {string} apiKey - The Gemini API key to store.
 */
function setGeminiApiKey(apiKey) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
  console.log('API Key for Gemini has been set successfully.');
}


// --- CLIENT MANAGEMENT (CRUD) ---

/**
 * Retrieves all clients from the 'Clients' sheet.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CLIENTS);
    if (!sheet) return [];
    // Get all data, excluding the header row
    const data = sheet.getDataRange().getValues().slice(1);
    return data.map(row => ({
      id: row[0],
      name: row[1],
      email: row[2],
      phone: row[3],
      address: row[4]
    }));
  } catch (e) {
    console.error("Error fetching clients:", e);
    return []; // Return empty array on error
  }
}

/**
 * Gets the next available ID for a new record in a given sheet.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to check.
 * @returns {number} The next sequential ID.
 */
function getNextId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 1; // First record
  }
  // Get the ID from the last row (column 1) and add 1
  return sheet.getRange(lastRow, 1).getValue() + 1;
}

/**
 * Adds a new client to the 'Clients' sheet.
 * @param {Object} clientData - An object containing client details (name, email, phone, address).
 * @returns {Object} The newly added client object, including the new ID.
 */
function addClient(clientData) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CLIENTS);
    const newId = getNextId(sheet);
    const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];
    sheet.appendRow(newRow);
    return { id: newId, ...clientData };
  } catch (e) {
    console.error("Error adding client:", e);
    return null;
  }
}

/**
 * Updates an existing client's information in the 'Clients' sheet.
 * @param {Object} clientData - An object containing the client's ID and updated details.
 * @returns {Object} The updated client object or null if not found.
 */
function updateClient(clientData) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CLIENTS);
    const data = sheet.getDataRange().getValues();
    // Find the row index for the given client ID (skip header)
    const rowIndex = data.findIndex((row, i) => i > 0 && row[0] == clientData.id);

    if (rowIndex === -1) {
      throw new Error("Client not found");
    }

    // rowIndex is 0-based, but sheet ranges are 1-based
    const sheetRow = rowIndex + 1;
    const range = sheet.getRange(sheetRow, 1, 1, 5); // Get range for the entire row
    range.setValues([[
      clientData.id,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ]]);

    return clientData;
  } catch (e) {
    console.error("Error updating client:", e);
    return null;
  }
}

/**
 * Deletes a client from the 'Clients' sheet.
 * @param {number} clientId - The ID of the client to delete.
 * @returns {boolean} True if deletion was successful, false otherwise.
 */
function deleteClient(clientId) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CLIENTS);
    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex((row, i) => i > 0 && row[0] == clientId);

    if (rowIndex !== -1) {
      // rowIndex is 0-based, sheet rows are 1-based
      sheet.deleteRow(rowIndex + 1);
      return true;
    }
    return false; // Client not found
  } catch (e) {
    console.error("Error deleting client:", e);
    return false;
  }
}