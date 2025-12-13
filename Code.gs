const SCRIPT_PROP = PropertiesService.getScriptProperties();

function setup() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  SCRIPT_PROP.setProperty("key", activeSpreadsheet.getId());
}

const SHEETS = (() => {
  try {
    const ss = SpreadsheetApp.openById(SCRIPT_PROP.getProperty("key"));
    return {
      users: ss.getSheetByName('Users') || ss.insertSheet('Users'),
      clients: ss.getSheetByName('Clients') || ss.insertSheet('Clients'),
    };
  } catch (error) {
    console.error("Failed to open spreadsheet. Please run setup.", error);
    return null;
  }
})();

function doGet(e) {
  if (!SHEETS) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Spreadsheet not configured. Please run setup." })).setMimeType(ContentService.MimeType.JSON);
  }
  const op = e.parameter.action;
  let response;

  switch(op) {
    case 'getClients':
      response = getClients();
      break;
    default:
      response = { error: "Invalid action" };
  }

  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  if (!SHEETS) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Spreadsheet not configured. Please run setup." })).setMimeType(ContentService.MimeType.JSON);
  }
  const op = e.parameter.action;
  const data = JSON.parse(e.postData.contents);
  let response;

  switch(op) {
    case 'setup':
      response = setupTables();
      break;
    case 'login':
      response = login(data);
      break;
    case 'addClient':
      response = addClient(data);
      break;
    case 'updateClient':
      response = updateClient(data);
      break;
    case 'deleteClient':
      response = deleteClient(data);
      break;
    default:
      response = { error: "Invalid action" };
  }

  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

function setupTables() {
  try {
    const usersSheet = SHEETS.users;
    usersSheet.clear();
    usersSheet.appendRow(["ID", "Name", "Email", "PasswordHash", "Salt"]);
    const salt = Utilities.getUuid();
    usersSheet.appendRow([1, "Test User", "test@example.com", hashPassword("password", salt), salt]);

    const clientsSheet = SHEETS.clients;
    clientsSheet.clear();
    clientsSheet.appendRow(["ID", "Name", "Email", "Phone", "Address"]);
    clientsSheet.appendRow([1, 'Cliente de Ejemplo S.A.S', 'ejemplo@correo.com', '3001234567', 'Calle Falsa 123']);

    return { success: true, message: "Tables created successfully." };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// NOTE: This is a basic hashing implementation for demonstration purposes and is not cryptographically secure.
// For a real-world application, use a library that includes salting and multiple rounds of hashing.
function hashPassword(password, salt) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt);
  return digest.map(byte => {
    const v = (byte & 0xFF).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function login(data) {
  try {
    const usersSheet = SHEETS.users;
    const users = usersSheet.getDataRange().getValues();
    const userRow = users.find(u => u[2] === data.email);
    if (userRow) {
      const salt = userRow[4];
      const hashedPassword = hashPassword(data.password, salt);
      if (userRow[3] === hashedPassword) {
        return { success: true, user: { id: userRow[0], name: userRow[1], email: userRow[2] } };
      }
    }
    return { success: false, message: "Invalid credentials" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
      return { success: false, message: "Invalid credentials" };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getClients() {
  try {
    const clientsSheet = SHEETS.clients;
    const clients = clientsSheet.getDataRange().getValues();
    clients.shift();
    return { success: true, clients: clients.map(c => ({ id: c[0], name: c[1], email: c[2], phone: c[3], address: c[4] })) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function addClient(data) {
  try {
    const clientsSheet = SHEETS.clients;
    const clients = clientsSheet.getDataRange().getValues();
    clients.shift(); // Remove header row
    const maxId = clients.reduce((max, row) => Math.max(max, row[0]), 0);
    const newId = maxId + 1;
    clientsSheet.appendRow([newId, data.name, data.email, data.phone, data.address]);
    return { success: true, message: "Client added successfully." };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function updateClient(data) {
  try {
    const clientsSheet = SHEETS.clients;
    const clients = clientsSheet.getDataRange().getValues();
    const rowIndex = clients.findIndex(c => c[0] == data.id);
    if (rowIndex > -1) {
      clientsSheet.getRange(rowIndex + 1, 2).setValue(data.name);
      clientsSheet.getRange(rowIndex + 1, 3).setValue(data.email);
      clientsSheet.getRange(rowIndex + 1, 4).setValue(data.phone);
      clientsSheet.getRange(rowIndex + 1, 5).setValue(data.address);
      return { success: true, message: "Client updated successfully." };
    } else {
      return { success: false, message: "Client not found." };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function deleteClient(data) {
  try {
    const clientsSheet = SHEETS.clients;
    const clients = clientsSheet.getDataRange().getValues();
    const rowIndex = clients.findIndex(c => c[0] == data.id);
    if (rowIndex > -1) {
      clientsSheet.deleteRow(rowIndex + 1);
      return { success: true, message: "Client deleted successfully." };
    } else {
      return { success: false, message: "Client not found." };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}
