function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setTitle('TimeBill Pro')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Reemplaza esto con el ID de tu Google Sheet
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE";

/**
 * Crea las tablas iniciales (hojas) en la hoja de cálculo si no existen.
 */
function createInitialTables() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Crear hoja de Usuarios
    let usersSheet = sheet.getSheetByName("Usuarios");
    if (!usersSheet) {
      usersSheet = sheet.insertSheet("Usuarios");
      const userHeaders = [["ID", "Nombre", "Email", "HashedPassword", "Salt"]];
      usersSheet.getRange(1, 1, 1, 5).setValues(userHeaders);
      usersSheet.setFrozenRows(1);
    }

    // Crear hoja de Clientes
    let clientsSheet = sheet.getSheetByName("Clientes");
    if (!clientsSheet) {
      clientsSheet = sheet.insertSheet("Clientes");
      const clientHeaders = [["ID", "Nombre", "Email", "Teléfono", "Dirección"]];
      clientsSheet.getRange(1, 1, 1, 5).setValues(clientHeaders);
      clientsSheet.setFrozenRows(1);
    }

    return "Tablas 'Usuarios' y 'Clientes' creadas con éxito.";
  } catch (error) {
    Logger.log(error);
    throw new Error("No se pudieron crear las tablas. Revisa el SPREADSHEET_ID y los permisos.");
  }
}

/**
 * Registra un nuevo usuario en la hoja de cálculo.
 */
function registerUser(name, email, password) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Usuarios");
  const users = sheet.getDataRange().getValues();

  // Verificar si el usuario ya existe
  for (let i = 1; i < users.length; i++) {
    if (users[i][2] === email) {
      throw new Error("El correo electrónico ya está registrado.");
    }
  }

  // Crear el nuevo usuario
  const salt = Utilities.getUuid();
  const hashedPassword = hashPassword(password, salt);
  const newUserId = Utilities.getUuid();

  sheet.appendRow([newUserId, name, email, hashedPassword, salt]);

  return "Usuario registrado con éxito.";
}

/**
 * Inicia sesión de un usuario.
 */
function loginUser(email, password) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Usuarios");
  const users = sheet.getDataRange().getValues();

  // Encontrar al usuario por email
  for (let i = 1; i < users.length; i++) {
    if (users[i][2] === email) {
      const storedHashedPassword = users[i][3];
      const salt = users[i][4];
      const hashedPassword = hashPassword(password, salt);

      if (hashedPassword === storedHashedPassword) {
        return { id: users[i][0], name: users[i][1], email: users[i][2] }; // Login successful
      } else {
        return null; // Contraseña incorrecta
      }
    }
  }

  return null; // Usuario no encontrado
}

/**
 * Hashes a password with a salt using SHA-256.
 */
function hashPassword(password, salt) {
  const toHash = password + salt;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, toHash);
  return digest.map(byte => {
    const v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

/**
 * Obtiene todos los clientes de la hoja de cálculo.
 */
function getClients() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Clientes");
    const data = sheet.getDataRange().getValues();
    const clients = [];
    for (let i = 1; i < data.length; i++) {
      clients.push({
        id: data[i][0],
        name: data[i][1],
        email: data[i][2],
        phone: data[i][3],
        address: data[i][4],
      });
    }
    return clients;
  } catch (error) {
    Logger.log(error);
    throw new Error("No se pudieron obtener los clientes.");
  }
}

/**
 * Añade un nuevo cliente a la hoja de cálculo.
 */
function addClient(clientData) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Clientes");
    const newId = Utilities.getUuid();
    sheet.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
    return "Cliente añadido con éxito.";
  } catch (error) {
    Logger.log(error);
    throw new Error("No se pudo añadir el cliente.");
  }
}

/**
 * Edita un cliente existente en la hoja de cálculo.
 */
function editClient(clientData) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Clientes");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == clientData.id) {
        sheet.getRange(i + 1, 2, 1, 4).setValues([[clientData.name, clientData.email, clientData.phone, clientData.address]]);
        return "Cliente actualizado con éxito.";
      }
    }
    throw new Error("Cliente no encontrado.");
  } catch (error) {
    Logger.log(error);
    throw new Error("No se pudo actualizar el cliente.");
  }
}

/**
 * Elimina un cliente de la hoja de cálculo.
 */
function deleteClient(clientId) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Clientes");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == clientId) {
        sheet.deleteRow(i + 1);
        return "Cliente eliminado con éxito.";
      }
    }
    throw new Error("Cliente no encontrado.");
  } catch (error) {
    Logger.log(error);
    throw new Error("No se pudo eliminar el cliente.");
  }
}
