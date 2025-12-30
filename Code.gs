// --- CONFIGURATION ---
const SPREADSHEET_ID_PROP = 'spreadsheetId';

// --- CORE APP FUNCTIONS ---

function doGet() {
  const setupDone = isDatabaseSetup();
  const template = HtmlService.createTemplateFromFile('index');
  template.setupDone = setupDone;
  return template.evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- DATABASE SETUP ---

/**
 * Checks if the database (Google Sheet) has been set up.
 * @returns {boolean} True if the spreadsheet ID is stored in properties.
 */
function isDatabaseSetup() {
  return !!PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROP);
}

/**
 * Creates the Google Sheet database and sets up initial tables (sheets) and a default user.
 * This function is called from the client-side setup button.
 * @returns {object} A result object with a status message.
 */
function setupDatabase() {
  if (isDatabaseSetup()) {
    return { success: false, message: 'La base de datos ya ha sido configurada.' };
  }

  try {
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_PROP, spreadsheet.getId());

    const usersSheet = spreadsheet.insertSheet('Users');
    usersSheet.appendRow(['ID', 'Name', 'Email', 'HashedPassword', 'Salt']);

    const clientsSheet = spreadsheet.insertSheet('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address', 'OwnerId']);

    spreadsheet.deleteSheet(spreadsheet.getSheetByName('Sheet1'));

    // Create a default user
    const defaultEmail = 'user@example.com';
    const defaultPassword = 'password123';
    const salt = generateSalt();
    const hashedPassword = hashPassword(defaultPassword, salt);
    const userId = Utilities.getUuid();

    usersSheet.appendRow([userId, 'Default User', defaultEmail, hashedPassword, salt]);

    return {
      success: true,
      message: '¡Base de datos configurada con éxito!',
      defaultUser: { email: defaultEmail, password: defaultPassword }
    };
  } catch (e) {
    Logger.log(e);
    // Clean up if something went wrong
    PropertiesService.getScriptProperties().deleteProperty(SPREADSHEET_ID_PROP);
    return { success: false, message: 'Error al configurar la base de datos: ' + e.message };
  }
}

// --- AUTHENTICATION & SESSION ---

/**
 * Generates a random salt for password hashing.
 * @returns {string} A base64 encoded salt.
 */
function generateSalt() {
  const randomBytes = Utilities.getDigest(Utilities.DigestAlgorithm.SHA_256, Math.random().toString());
  return Utilities.base64Encode(randomBytes).substring(0, 16);
}

/**
 * Hashes a password with a given salt using SHA-256.
 * @param {string} password The plain text password.
 * @param {string} salt The salt.
 * @returns {string} The hashed password, base64 encoded.
 */
function hashPassword(password, salt) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(digest);
}

/**
 * Gets the active spreadsheet instance.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The spreadsheet object or null.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROP);
  if (!spreadsheetId) return null;
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (e) {
    Logger.log('Failed to open spreadsheet by ID: ' + e);
    return null;
  }
}

/**
 * Retrieves a user's data from the 'Users' sheet by email.
 * @param {string} email The user's email.
 * @returns {object|null} The user object or null if not found.
 */
function getUserByEmail(email) {
  const ss = getSpreadsheet();
  if (!ss) return null;
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  // Headers: ID, Name, Email, HashedPassword, Salt
   const emailCol = 2; // Note: .getValues() is a 0-based array index
  for (let i = 1; i < data.length; i++) {
    if (data[i][emailCol] === email) {
      return {
        id: data[i][0],
        name: data[i][1],
        email: data[i][2],
        hashedPassword: data[i][3],
        salt: data[i][4],
        rowIndex: i + 1
      };
    }
  }
  return null;
}

/**
 * Attempts to log in a user with their email and password.
 * @param {string} email The user's email.
 * @param {string} password The user's plain text password.
 * @returns {object} A result object with success status and user data or an error message.
 */
function login(email, password) {
  try {
    const user = getUserByEmail(email);
    if (!user) {
      return { success: false, message: 'Usuario no encontrado.' };
    }

    const hashedPassword = hashPassword(password, user.salt);

    if (hashedPassword === user.hashedPassword) {
      const userProperties = PropertiesService.getUserProperties();
      userProperties.setProperty('userId', user.id);
      return { success: true, user: { name: user.name, email: user.email } };
    } else {
      return { success: false, message: 'Contraseña incorrecta.' };
    }
  } catch (e) {
    Logger.log('Login error: ' + e);
    return { success: false, message: 'Ocurrió un error inesperado.' };
  }
}

/**
 * Checks if the current user is authenticated.
 * @returns {{isAuthenticated: boolean, user: {name: string, email: string}|null}}
 */
function checkAuth() {
    const userId = PropertiesService.getUserProperties().getProperty('userId');
    if (!userId) {
        return { isAuthenticated: false, user: null };
    }

    const ss = getSpreadsheet();
    if (!ss) {
        return { isAuthenticated: false, user: null }; // Or handle as an error state
    }
    const usersSheet = ss.getSheetByName('Users');
    const data = usersSheet.getDataRange().getValues();
    // Headers: ID, Name, Email, HashedPassword, Salt
    const idCol = 0;
    const nameCol = 1;
    const emailCol = 2;
    for (let i = 1; i < data.length; i++) {
        if (data[i][idCol] === userId) {
            return {
                isAuthenticated: true,
                user: { name: data[i][nameCol], email: data[i][emailCol] }
            };
        }
    }

    // If user ID from properties is not in the sheet, they are not authenticated.
    PropertiesService.getUserProperties().deleteProperty('userId');
    return { isAuthenticated: false, user: null };
}

/**
 * Logs out the current user by deleting their session property.
 */
function logout() {
  PropertiesService.getUserProperties().deleteProperty('userId');
}

// --- CLIENT CRUD OPERATIONS ---

/**
 * Helper to check if a user is authenticated. Throws an error if not.
 */
function isAuthenticated() {
    const userId = PropertiesService.getUserProperties().getProperty('userId');
    if (!userId) {
        throw new Error('Usuario no autenticado.');
    }
    return userId;
}

/**
 * Gets all clients for the logged-in user.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
    const userId = isAuthenticated();
    const ss = getSpreadsheet();
    if (!ss) return [];
    const sheet = ss.getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const clients = [];
    // Headers: ID, Name, Email, Phone, Address, OwnerId
    const ownerIdCol = 5;
    for (let i = 1; i < data.length; i++) {
        if (data[i][ownerIdCol] === userId) {
            clients.push({
                id: data[i][0],
                name: data[i][1],
                email: data[i][2],
                phone: data[i][3],
                address: data[i][4],
            });
        }
    }
    return clients;
}

/**
 * Adds a new client to the database.
 * @param {Object} clientData The client's information.
 * @returns {Object} The newly created client object.
 */
function addClient(clientData) {
    const userId = isAuthenticated();
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Clients');

    const newId = Utilities.getUuid();
    const newRow = [
        newId,
        clientData.name,
        clientData.email,
        clientData.phone,
        clientData.address,
        userId
    ];
    sheet.appendRow(newRow);

    return {
        id: newId,
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        address: clientData.address
    };
}

/**
 * Updates an existing client's information.
 * @param {Object} clientData The client data to update, including ID.
 * @returns {Object} A success message.
 */
function updateClient(clientData) {
    const userId = isAuthenticated();
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();

    const idCol = 0;
    const ownerIdCol = 5;

    for (let i = 1; i < data.length; i++) {
        if (data[i][idCol] === clientData.id && data[i][ownerIdCol] === userId) {
            sheet.getRange(i + 1, 2, 1, 4).setValues([[
                clientData.name,
                clientData.email,
                clientData.phone,
                clientData.address
            ]]);
            return { success: true, message: 'Cliente actualizado.' };
        }
    }
    throw new Error('Cliente no encontrado o no tienes permiso para editarlo.');
}

/**
 * Deletes a client from the database.
 * @param {string} clientId The ID of the client to delete.
 * @returns {Object} A success message.
 */
function deleteClient(clientId) {
    const userId = isAuthenticated();
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();

    const idCol = 0;
    const ownerIdCol = 5;

    // Iterate backwards to avoid issues with row deletion
    for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][idCol] === clientId && data[i][ownerIdCol] === userId) {
            sheet.deleteRow(i + 1);
            return { success: true, message: 'Cliente eliminado.' };
        }
    }
    throw new Error('Cliente no encontrado o no tienes permiso para eliminarlo.');
}
