const ss = SpreadsheetApp.getActiveSpreadsheet();

// --- Web App Entry Point ---
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- Setup Function ---
function setup() {
  try {
    const sheetNames = ['Users', 'Clients', 'Invoices'];
    sheetNames.forEach(name => {
      if (!ss.getSheetByName(name)) {
        const sheet = ss.insertSheet(name);
        if (name === 'Users') {
          sheet.appendRow(['ID', 'Username', 'PasswordHash', 'Salt']);
        } else if (name === 'Clients') {
          sheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
        } else if (name === 'Invoices') {
          sheet.appendRow(['ID', 'ClientID', 'DateTime', 'DurationHours', 'HourlyRate', 'TotalAmount']);
        }
      }
    });
    // Add a default admin user if one doesn't exist
    const usersSheet = ss.getSheetByName('Users');
    const usersData = usersSheet.getDataRange().getValues();
    if (usersData.length <= 1) { // Only header row exists
        addUser('admin', 'admin');
    }
    return { success: true, message: 'Sheets created successfully!' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}


// --- User Authentication ---
function addUser(username, password) {
  const usersSheet = ss.getSheetByName('Users');
  const salt = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Math.random().toString()));
  const passwordHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt));
  const newId = getNextId('Users');
  usersSheet.appendRow([newId, username, passwordHash, salt]);
  return { success: true, message: 'User added successfully' };
}

function checkLogin(username, password) {
  const usersSheet = ss.getSheetByName('Users');
  const data = usersSheet.getDataRange().getValues();
  // Start from 1 to skip header row
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username) {
      const storedHash = data[i][2];
      const salt = data[i][3];
      const inputHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt));
      if (inputHash === storedHash) {
        return { success: true, user: { id: data[i][0], username: data[i][1] } };
      }
    }
  }
  return { success: false, message: 'Invalid username or password' };
}

// --- Client CRUD Operations ---
function getClients() {
  const clientsSheet = ss.getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  const clients = [];
  // Start from 1 to skip header row
  for (let i = 1; i < data.length; i++) {
    clients.push({
      id: data[i][0],
      name: data[i][1],
      email: data[i][2],
      phone: data[i][3],
      address: data[i][4]
    });
  }
  return clients;
}

function addClient(clientData) {
  try {
    const clientsSheet = ss.getSheetByName('Clients');
    const newId = getNextId('Clients');
    clientsSheet.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
    clientData.id = newId;
    return { success: true, client: clientData };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function updateClient(clientData) {
    try {
        const clientsSheet = ss.getSheetByName('Clients');
        const data = clientsSheet.getDataRange().getValues();
        let rowIndex = -1;
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] == clientData.id) {
                rowIndex = i + 1; // 1-based index
                break;
            }
        }
        if (rowIndex !== -1) {
            clientsSheet.getRange(rowIndex, 2, 1, 4).setValues([[clientData.name, clientData.email, clientData.phone, clientData.address]]);
            return { success: true, client: clientData };
        } else {
            return { success: false, message: 'Client not found' };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
}


function deleteClient(clientId) {
  try {
    const clientsSheet = ss.getSheetByName('Clients');
    const data = clientsSheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == clientId) {
        rowIndex = i + 1; // 1-based index
        break;
      }
    }
    if (rowIndex !== -1) {
      clientsSheet.deleteRow(rowIndex);
      return { success: true, message: 'Client deleted' };
    } else {
      return { success: false, message: 'Client not found' };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// --- Helper Function ---
function getNextId(sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getRange("A:A").getValues();
  const maxId = data.reduce((max, row) => {
    const id = parseInt(row[0]);
    return (id > max) ? id : max;
  }, 0);
  return maxId + 1;
}

// --- Invoice Function ---
function saveInvoice(invoiceData) {
    try {
        const invoicesSheet = ss.getSheetByName('Invoices');
        const newId = getNextId('Invoices');
        invoicesSheet.appendRow([
            newId,
            invoiceData.clientId,
            new Date(),
            invoiceData.duration,
            invoiceData.rate,
            invoiceData.total
        ]);
        return { success: true, invoiceId: newId };
    } catch (error) {
        return { success: false, message: error.message };
    }
}