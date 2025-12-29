// --- GLOBAL CONSTANTS ---
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const DB = SpreadsheetApp.openById(SPREADSHEET_ID);
const USERS_SHEET = DB.getSheetByName('Users');
const CLIENTS_SHEET = DB.getSheetByName('Clients');

// --- AUTHENTICATION ---

/**
 * Hashes a password using SHA-256 with a given salt.
 * @param {string} password The password to hash.
 * @param {string} salt The salt to use.
 * @return {string} The hashed password as a hex string.
 */
function hashPassword_(password, salt) {
  const saltedPassword = password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, saltedPassword);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Verifies a password against a stored hash.
 * @param {string} password The password to verify.
 * @param {string} salt The salt used for the original hash.
 * @param {string} storedHash The stored hashed password.
 * @return {boolean} True if the password is correct, false otherwise.
 */
function verifyPassword_(password, salt, storedHash) {
  const newHash = hashPassword_(password, salt);
  return newHash === storedHash;
}

/**
 * Logs in a user. For this demo, we'll use a default user if one doesn't exist.
 * This is NOT a secure login system for production.
 * @param {string} email The user's email.
 * @param {string} password The user's password.
 * @return {object} An object with success status and a message or user data.
 */
function login(email, password) {
  try {
    // Ensure the sheet and headers exist
    if (USERS_SHEET.getLastRow() < 1) {
      USERS_SHEET.appendRow(['ID', 'Name', 'Email', 'HashedPassword', 'Salt']);
    }

    const usersData = USERS_SHEET.getDataRange().getValues();
    const headers = usersData.shift();
    const emailCol = headers.indexOf('Email');

    let user = usersData.find(row => row[emailCol] === email);

    // If no user found, create a default "demo" user
    if (!user) {
      const salt = Utilities.getUuid();
      const hashedPassword = hashPassword_('demo', salt);
      const userId = Utilities.getUuid();
      const newUser = [userId, 'Demo User', email, hashedPassword, salt];
      USERS_SHEET.appendRow(newUser);
      user = newUser; // Use the newly created user for the session
    }

    const saltCol = headers.indexOf('Salt');
    const hashCol = headers.indexOf('HashedPassword');
    const idCol = headers.indexOf('ID');

    if (verifyPassword_(password, user[saltCol], user[hashCol])) {
      const userProperties = PropertiesService.getUserProperties();
      userProperties.setProperty('userId', user[idCol]);
      return { success: true, message: 'Login successful.' };
    } else {
      return { success: false, message: 'Invalid email or password.' };
    }
  } catch (e) {
    console.error('Login Error: ' + e.toString());
    return { success: false, message: 'An error occurred during login.' };
  }
}

/**
 * Checks if the current user is authenticated.
 * @return {boolean} True if the user has a valid session.
 */
function checkAuth() {
    const userId = PropertiesService.getUserProperties().getProperty('userId');
    return !!userId;
}

/**
 * Logs the current user out by deleting their session property.
 */
function logout() {
    PropertiesService.getUserProperties().deleteProperty('userId');
}

/**
 * Middleware to check if a user is authenticated before running a function.
 * @return {boolean} True if authenticated.
 * @throws {Error} If not authenticated.
 */
function isAuthenticated_() {
  if (!checkAuth()) {
    throw new Error('User not authenticated.');
  }
  return true;
}

// --- CLIENTS CRUD ---

/**
 * Gets all clients from the spreadsheet.
 * @return {Array<Object>} An array of client objects.
 */
function getClients() {
  isAuthenticated_();
  try {
    if (CLIENTS_SHEET.getLastRow() < 2) return []; // No clients if only header exists
    const data = CLIENTS_SHEET.getDataRange().getValues();
    const headers = data.shift();
    return data.map(row => {
      const client = {};
      headers.forEach((header, i) => {
        client[header.toLowerCase()] = row[i];
      });
      return client;
    });
  } catch (e) {
    console.error('getClients Error: ' + e.toString());
    return [];
  }
}

/**
 * Adds a new client to the spreadsheet.
 * @param {Object} clientData The client data to add.
 * @return {Object} The newly added client object.
 */
function addClient(clientData) {
  isAuthenticated_();
  try {
    // Ensure the sheet and headers exist
    if (CLIENTS_SHEET.getLastRow() < 1) {
      CLIENTS_SHEET.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    }

    const newId = Utilities.getUuid();
    const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];
    CLIENTS_SHEET.appendRow(newRow);
    return { id: newId, ...clientData };
  } catch (e) {
    console.error('addClient Error: ' + e.toString());
    throw new Error('Failed to add client.');
  }
}

/**
 * Updates an existing client's information.
 * @param {Object} clientData The client data to update, must include ID.
 * @return {Object} The updated client object.
 */
function updateClient(clientData) {
  isAuthenticated_();
  try {
    const data = CLIENTS_SHEET.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('ID');
    const rowIndex = data.findIndex(row => row[idCol] === clientData.id);

    if (rowIndex === -1) {
      throw new Error('Client not found.');
    }

    const newRow = headers.map(header => clientData[header.toLowerCase()] || '');
    CLIENTS_SHEET.getRange(rowIndex + 1, 1, 1, newRow.length).setValues([newRow]);

    return clientData;
  } catch (e) {
    console.error('updateClient Error: ' + e.toString());
    throw new Error('Failed to update client.');
  }
}

/**
 * Deletes a client from the spreadsheet.
 * @param {string} clientId The ID of the client to delete.
 * @return {Object} An object with a success status.
 */
function deleteClient(clientId) {
  isAuthenticated_();
  try {
    const data = CLIENTS_SHEET.getDataRange().getValues();
    const idCol = data[0].indexOf('ID');
    const rowIndex = data.findIndex(row => row[idCol] === clientId);

    if (rowIndex === -1) {
      throw new Error('Client not found.');
    }

    CLIENTS_SHEET.deleteRow(rowIndex + 1);
    return { success: true };
  } catch (e) {
    console.error('deleteClient Error: ' + e.toString());
    throw new Error('Failed to delete client.');
  }
}
// --- GEMINI API ---

/**
 * Generates an email draft using the Gemini API.
 * The API key is stored securely in Script Properties.
 * @param {string} prompt The prompt to send to the Gemini API.
 * @return {string} The generated text content.
 */
function generateEmailDraft(prompt) {
    isAuthenticated_();
    const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!API_KEY) {
        throw new Error("API key for Gemini not set in Script Properties.");
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

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
        muteHttpExceptions: true // Prevents throwing an exception for non-2xx responses
    };

    try {
        const response = UrlFetchApp.fetch(API_URL, options);
        const result = JSON.parse(response.getContentText());

        if (response.getResponseCode() !== 200) {
            console.error('Gemini API Error Response:', result);
            throw new Error(`Gemini API request failed with status ${response.getResponseCode()}: ${result.error.message}`);
        }

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            return result.candidates[0].content.parts[0].text;
        } else {
            console.warn('Gemini API Response did not contain expected content:', result);
            throw new Error("No content generated or unexpected response structure.");
        }
    } catch (e) {
        console.error('Error calling Gemini API: ' + e.toString());
        // Return a more descriptive error to the client-side
        throw new Error(`Failed to generate email draft. Details: ${e.message}`);
    }
}


// --- WEB APP ---

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
