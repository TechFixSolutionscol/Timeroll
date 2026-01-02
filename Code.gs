function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Checks if the database (Google Sheet) has been set up.
 * @returns {boolean} True if the spreadsheet ID is stored in script properties, false otherwise.
 */
function checkDatabaseStatus() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty('spreadsheetId');
  return !!spreadsheetId;
}

/**
 * Creates a new Google Sheet to act as the database for the application.
 * Initializes 'Clients' and 'Users' sheets with appropriate headers.
 * Stores the new spreadsheet's ID in script properties.
 * This function is intended to be run once by the user.
 */
function setupDatabase() {
  try {
    // Check if the database is already set up to prevent duplicates
    if (checkDatabaseStatus()) {
      return { status: 'success', message: 'La base de datos ya está configurada.' };
    }

    // Create a new spreadsheet and get its ID
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();

    // Store the spreadsheet ID in script properties for later access
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

    // Set up the 'Clients' sheet
    const clientsSheet = spreadsheet.getSheets()[0];
    clientsSheet.setName('Clients');
    const clientHeaders = ['ID', 'Name', 'Email', 'Phone', 'Address'];
    clientsSheet.getRange(1, 1, 1, clientHeaders.length).setValues([clientHeaders]).setFontWeight('bold');
    clientsSheet.setFrozenRows(1);

    // Set up the 'Users' sheet
    const usersSheet = spreadsheet.insertSheet('Users');
    const userHeaders = ['ID', 'Email', 'PasswordHash', 'Salt'];
    usersSheet.getRange(1, 1, 1, userHeaders.length).setValues([userHeaders]).setFontWeight('bold');
    usersSheet.setFrozenRows(1);

    // Make the ID columns wider for better readability
    clientsSheet.setColumnWidth(1, 150);
    usersSheet.setColumnWidth(1, 150);


    return { status: 'success', message: `Base de datos creada con éxito. ID: ${spreadsheetId}` };
  } catch (error) {
    Logger.log('Error in setupDatabase: ' + error.toString());
    return { status: 'error', message: 'Se produjo un error al configurar la base de datos: ' + error.toString() };
  }
}

// --- Helper Functions ---

/**
 * Gets the active spreadsheet database.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The spreadsheet object.
 */
function getDb_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Database not set up. Please run the setup function.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * Generates a SHA-256 hash of a password with a given salt.
 * @param {string} password The password to hash.
 * @param {string} salt The salt to use for hashing.
 * @returns {string} The hexadecimal representation of the hash.
 */
function hashPassword_(password, salt) {
  const saltedPassword = password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, saltedPassword);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

// --- User Authentication Functions ---

/**
 * Signs up a new user.
 * @param {string} email The user's email address.
 * @param {string} password The user's plaintext password.
 * @returns {object} A status object.
 */
function signUp(email, password) {
  if (!email || !password) {
    return { status: 'error', message: 'El correo electrónico y la contraseña son obligatorios.' };
  }

  try {
    const usersSheet = getDb_().getSheetByName('Users');
    const emailColumn = 2;
    const existingUsers = usersSheet.getRange(2, emailColumn, usersSheet.getLastRow(), 1).getValues();

    if (existingUsers.some(row => row[0].toLowerCase() === email.toLowerCase())) {
      return { status: 'error', message: 'Este correo electrónico ya está registrado.' };
    }

    const salt = Utilities.getUuid();
    const passwordHash = hashPassword_(password, salt);
    const userId = Utilities.getUuid();

    usersSheet.appendRow([userId, email, passwordHash, salt]);

    return { status: 'success', message: 'Usuario registrado con éxito.' };
  } catch (error) {
    Logger.log('Error in signUp: ' + error.toString());
    return { status: 'error', message: 'Se produjo un error durante el registro: ' + error.toString() };
  }
}

/**
 * Logs in a user.
 * @param {string} email The user's email address.
 * @param {string} password The user's plaintext password.
 * @returns {object} A status object, including user data on success.
 */
function login(email, password) {
  if (!email || !password) {
    return { status: 'error', message: 'El correo electrónico y la contraseña son obligatorios.' };
  }

  try {
    const usersSheet = getDb_().getSheetByName('Users');
    const data = usersSheet.getDataRange().getValues();
    const headers = data.shift();
    const emailIndex = headers.indexOf('Email');
    const hashIndex = headers.indexOf('PasswordHash');
    const saltIndex = headers.indexOf('Salt');

    const userRow = data.find(row => row[emailIndex].toLowerCase() === email.toLowerCase());

    if (!userRow) {
      return { status: 'error', message: 'Usuario o contraseña incorrectos.' };
    }

    const storedHash = userRow[hashIndex];
    const salt = userRow[saltIndex];
    const passwordHash = hashPassword_(password, salt);

    if (passwordHash === storedHash) {
      return { status: 'success', message: 'Inicio de sesión exitoso.', user: { email: userRow[emailIndex] } };
    } else {
      return { status: 'error', message: 'Usuario o contraseña incorrectos.' };
    }
  } catch (error) {
    Logger.log('Error in login: ' + error.toString());
    return { status: 'error', message: 'Se produjo un error durante el inicio de sesión: ' + error.toString() };
  }
}

// --- Client Management Functions ---

/**
 * Retrieves all clients from the 'Clients' sheet.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
  try {
    const clientsSheet = getDb_().getSheetByName('Clients');
    const data = clientsSheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header row

    // If there are no clients, return an empty array
    if (data.length === 0) {
      return [];
    }

    return data.map(row => {
      let client = {};
      headers.forEach((header, index) => {
        client[header.toLowerCase()] = row[index];
      });
      return client;
    });
  } catch (error) {
    Logger.log('Error in getClients: ' + error.toString());
    return []; // Return empty array on error
  }
}

/**
 * Adds a new client to the 'Clients' sheet.
 * @param {Object} clientData The client's data.
 * @returns {object} A status object with the new client's data.
 */
function addClient(clientData) {
  try {
    const clientsSheet = getDb_().getSheetByName('Clients');
    const newId = Utilities.getUuid();
    const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];

    clientsSheet.appendRow(newRow);

    return { status: 'success', client: { id: newId, ...clientData } };
  } catch (error) {
    Logger.log('Error in addClient: ' + error.toString());
    return { status: 'error', message: 'Se produjo un error al añadir el cliente.' };
  }
}

/**
 * Updates an existing client in the 'Clients' sheet.
 * @param {Object} clientData The updated client data, including ID.
 * @returns {object} A status object.
 */
function updateClient(clientData) {
  try {
    const clientsSheet = getDb_().getSheetByName('Clients');
    const data = clientsSheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('ID');

    const rowIndex = data.findIndex(row => row[idIndex] === clientData.id);

    if (rowIndex === -1) {
      return { status: 'error', message: 'Cliente no encontrado.' };
    }

    // rowIndex in data is 0-based for rows after header, but sheet rows are 1-based.
    // So, the actual sheet row number is rowIndex + 1.
    const sheetRow = rowIndex + 1;
    const updatedRow = [
      clientData.id,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ];

    clientsSheet.getRange(sheetRow, 1, 1, updatedRow.length).setValues([updatedRow]);

    return { status: 'success' };
  } catch (error) {
    Logger.log('Error in updateClient: ' + error.toString());
    return { status: 'error', message: 'Se produjo un error al actualizar el cliente.' };
  }
}

/**
 * Deletes a client from the 'Clients' sheet by ID.
 * @param {string} clientId The ID of the client to delete.
 * @returns {object} A status object.
 */
function deleteClient(clientId) {
  try {
    const clientsSheet = getDb_().getSheetByName('Clients');
    const data = clientsSheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('ID');

    // Find the row index of the client to delete.
    // We search from the end to safely delete rows without messing up indices of subsequent rows.
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][idIndex] === clientId) {
        clientsSheet.deleteRow(i + 1);
        return { status: 'success' };
      }
    }

    return { status: 'error', message: 'Cliente no encontrado.' };
  } catch (error) {
    Logger.log('Error in deleteClient: ' + error.toString());
    return { status: 'error', message: 'Se produjo un error al eliminar el cliente.' };
  }
}

// --- AI Email Generation ---

/**
 * Generates an email draft using the Gemini API.
 * The API key is stored in Script Properties.
 * @param {object} invoiceData The data for the invoice (client, hours, total).
 * @returns {object} A status object with the email draft on success.
 */
function generateEmailDraft(invoiceData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return { status: 'error', message: 'La clave API de Gemini no está configurada en las propiedades del script.' };
  }

  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.name} y su correo es ${client.email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  try {
    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      }),
      muteHttpExceptions: true // Prevents throwing an exception for non-2xx responses
    });

    const responseCode = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    if (responseCode === 200 && result.candidates && result.candidates.length > 0) {
      const text = result.candidates[0].content.parts[0].text;
      return { status: 'success', draft: text };
    } else {
      Logger.log('Gemini API Error Response: ' + response.getContentText());
      return { status: 'error', message: 'No se pudo generar el borrador. ' + (result.error ? result.error.message : 'Respuesta inválida de la API.') };
    }
  } catch (error) {
    Logger.log('Error calling Gemini API: ' + error.toString());
    return { status: 'error', message: 'Se produjo un error al contactar con la API de IA.' };
  }
}
