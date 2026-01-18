
function doGet(e) {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setViewportContent('width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// =================================================================
// DATABASE SETUP AND HELPERS
// =================================================================

function setupDatabase() {
  try {
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();

    const clientsSheet = spreadsheet.getSheetByName('Sheet1');
    clientsSheet.setName('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    clientsSheet.setFrozenRows(1);

    const usersSheet = spreadsheet.insertSheet('Users');
    usersSheet.appendRow(['Username', 'PasswordHash']);
    usersSheet.getRange('A2').setValue('demo');
    usersSheet.getRange('B2').setValue(hashPassword_('demo'));
    usersSheet.setFrozenRows(1);

    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

    return { success: true, message: `Base de datos '${spreadsheet.getName()}' creada. ID: ${spreadsheetId}` };
  } catch (error) {
    Logger.log(`Error in setupDatabase: ${error.message}`);
    return { success: false, message: `Error al crear la base de datos: ${error.message}` };
  }
}

function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('El ID de la hoja de cálculo no está configurado. Ejecuta la configuración primero.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

// =================================================================
// USER AUTHENTICATION
// =================================================================

function hashPassword_(password) {
  const hashedPassword = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return hashedPassword.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

function loginUser(username, password) {
  try {
    const usersSheet = getSpreadsheet().getSheetByName('Users');
    const data = usersSheet.getDataRange().getValues();
    const passwordHash = hashPassword_(password);

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === username && data[i][1] === passwordHash) {
        return { success: true, message: 'Inicio de sesión exitoso.' };
      }
    }
    return { success: false, message: 'Usuario o contraseña incorrectos.' };
  } catch (error) {
    Logger.log(`Error in loginUser: ${error.message}`);
    return { success: false, message: `Error: ${error.message}` };
  }
}

// =================================================================
// CLIENT CRUD OPERATIONS
// =================================================================

function getClients() {
  try {
    const clientsSheet = getSpreadsheet().getSheetByName('Clients');
    const data = clientsSheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header row

    const clients = data.map(row => {
      let client = {};
      headers.forEach((header, i) => {
        client[header] = row[i];
      });
      return client;
    });

    return { success: true, data: clients };
  } catch (error) {
    Logger.log(`Error in getClients: ${error.message}`);
    return { success: false, message: `Error al obtener clientes: ${error.message}` };
  }
}

function addClient(clientData) {
  try {
    const clientsSheet = getSpreadsheet().getSheetByName('Clients');
    const idColumn = clientsSheet.getRange('A2:A').getValues().flat().filter(String);
    const maxId = idColumn.length > 0 ? Math.max(...idColumn) : 0;
    const newId = maxId + 1;

    clientsSheet.appendRow([
      newId,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ]);

    return { success: true, message: 'Cliente añadido con éxito.', newId: newId };
  } catch (error) {
    Logger.log(`Error in addClient: ${error.message}`);
    return { success: false, message: `Error al añadir cliente: ${error.message}` };
  }
}

function updateClient(clientData) {
  try {
    const clientsSheet = getSpreadsheet().getSheetByName('Clients');
    const data = clientsSheet.getDataRange().getValues();

    const rowIndex = data.findIndex(row => row[0] == clientData.id);

    if (rowIndex === -1) {
      return { success: false, message: 'Cliente no encontrado.' };
    }

    clientsSheet.getRange(rowIndex + 1, 2).setValue(clientData.name);
    clientsSheet.getRange(rowIndex + 1, 3).setValue(clientData.email);
    clientsSheet.getRange(rowIndex + 1, 4).setValue(clientData.phone);
    clientsSheet.getRange(rowIndex + 1, 5).setValue(clientData.address);

    return { success: true, message: 'Cliente actualizado con éxito.' };
  } catch (error) {
    Logger.log(`Error in updateClient: ${error.message}`);
    return { success: false, message: `Error al actualizar cliente: ${error.message}` };
  }
}

function deleteClient(clientId) {
  try {
    const clientsSheet = getSpreadsheet().getSheetByName('Clients');
    const data = clientsSheet.getDataRange().getValues();

    const rowIndex = data.findIndex(row => row[0] == clientId);

    if (rowIndex === -1) {
      return { success: false, message: 'Cliente no encontrado.' };
    }

    clientsSheet.deleteRow(rowIndex + 1);

    return { success: true, message: 'Cliente eliminado con éxito.' };
  } catch (error) {
    Logger.log(`Error in deleteClient: ${error.message}`);
    return { success: false, message: `Error al eliminar cliente: ${error.message}` };
  }
}
