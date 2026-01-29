const CONSTANTS = Object.freeze({
    APP_NAME: 'TimeBill Pro',
    SHEET_NAMES: Object.freeze({
        USERS: 'Usuarios',
        CLIENTS: 'Clientes'
    }),
    PROPERTIES: Object.freeze({
        SPREADSHEET_ID: 'spreadsheetId',
        GEMINI_API_KEY: 'geminiApiKey'
    }),
    UI: Object.freeze({
        MENU_NAME: 'TimeBill Pro'
    })
});

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu(CONSTANTS.UI.MENU_NAME)
        .addItem('Configurar Base de Datos', 'setupDatabase')
        .addItem('Establecer Clave API de Gemini', 'setGeminiApiKey')
        .addToUi();
}

function doGet(e) {
    if (checkAuth()) {
        return HtmlService.createTemplateFromFile('index').evaluate()
            .setTitle(CONSTANTS.APP_NAME)
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } else {
        return HtmlService.createTemplateFromFile('Login').evaluate()
            .setTitle(`${CONSTANTS.APP_NAME} - Iniciar Sesión`)
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
}

function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSpreadsheet() {
    try {
        const spreadsheetId = PropertiesService.getScriptProperties().getProperty(CONSTANTS.PROPERTIES.SPREADSHEET_ID);
        if (!spreadsheetId) {
            throw new Error('La base de datos no ha sido configurada. Por favor, ejecute la función "Configurar Base de Datos" desde el menú de TimeBill Pro.');
        }
        return SpreadsheetApp.openById(spreadsheetId);
    } catch (e) {
        Logger.log(`Error en getSpreadsheet: ${e.message}`);
        throw new Error(`No se pudo abrir la hoja de cálculo. ${e.message}`);
    }
}

function checkAuth() {
    const userProperties = PropertiesService.getUserProperties();
    const sessionToken = userProperties.getProperty('sessionToken');
    // In a real app, you'd validate this token more robustly
    return sessionToken != null;
}

function logout() {
    PropertiesService.getUserProperties().deleteProperty('sessionToken');
}

function setupDatabase() {
    const ui = SpreadsheetApp.getUi();
    try {
        const spreadsheet = SpreadsheetApp.create(CONSTANTS.APP_NAME + " Base de Datos");
        PropertiesService.getScriptProperties().setProperty(CONSTANTS.PROPERTIES.SPREADSHEET_ID, spreadsheet.getId());

        const usersSheet = spreadsheet.insertSheet(CONSTANTS.SHEET_NAMES.USERS);
        usersSheet.appendRow(['ID', 'Username', 'PasswordHash', 'Salt']);
        // Add a default admin user
        const salt = Utilities.getUuid();
        const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'admin' + salt).map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
        usersSheet.appendRow([1, 'admin', passwordHash, salt]);

        const clientsSheet = spreadsheet.insertSheet(CONSTANTS.SHEET_NAMES.CLIENTS);
        clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
        clientsSheet.appendRow([1, 'Cliente de Ejemplo S.A.S', 'ejemplo@correo.com', '3001234567', 'Calle Falsa 123']);

        spreadsheet.deleteSheet(spreadsheet.getSheetByName('Sheet1'));

        ui.alert('Base de Datos Configurada', `La base de datos ha sido configurada exitosamente. El ID de la hoja de cálculo es: ${spreadsheet.getId()}`, ui.ButtonSet.OK);
    } catch (e) {
        Logger.log(`Error en setupDatabase: ${e.message}`);
        ui.alert('Error', `Ocurrió un error al configurar la base de datos: ${e.message}`, ui.ButtonSet.OK);
    }
}

function login(username, password) {
    const sheet = getSpreadsheet().getSheetByName(CONSTANTS.SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const usernameIndex = headers.indexOf('Username');
    const passwordHashIndex = headers.indexOf('PasswordHash');
    const saltIndex = headers.indexOf('Salt');

    for (let i = 0; i < data.length; i++) {
        if (data[i][usernameIndex] === username) {
            const salt = data[i][saltIndex];
            const storedHash = data[i][passwordHashIndex];
            const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt).map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
            if (passwordHash === storedHash) {
                const sessionToken = Utilities.getUuid();
                PropertiesService.getUserProperties().setProperty('sessionToken', sessionToken);
                return { username: username };
            }
        }
    }
    return null;
}

function getInitialData() {
    return {
        clients: getClients()
    };
}

function getClients() {
    const sheet = getSpreadsheet().getSheetByName(CONSTANTS.SHEET_NAMES.CLIENTS);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    return data.map(row => {
        const client = {};
        headers.forEach((header, i) => {
            client[header] = row[i];
        });
        return client;
    });
}

function addClient(clientData) {
    const sheet = getSpreadsheet().getSheetByName(CONSTANTS.SHEET_NAMES.CLIENTS);
    const ids = sheet.getRange('A:A').getValues().flat().filter(id => typeof id === 'number');
    const maxId = ids.length > 0 ? Math.max(...ids) : 0;
    const newId = maxId + 1;
    const newRow = [newId, clientData.Name, clientData.Email, clientData.Phone, clientData.Address];
    sheet.appendRow(newRow);
    return { ...clientData, ID: newId };
}

function updateClient(clientData) {
    const sheet = getSpreadsheet().getSheetByName(CONSTANTS.SHEET_NAMES.CLIENTS);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const idIndex = headers.indexOf('ID');

    for (let i = 0; i < data.length; i++) {
        if (data[i][idIndex] === clientData.ID) {
            sheet.getRange(i + 2, 1, 1, headers.length).setValues([[clientData.ID, clientData.Name, clientData.Email, clientData.Phone, clientData.Address]]);
            return clientData;
        }
    }
    throw new Error('Cliente no encontrado.');
}

function setGeminiApiKey() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt('Establecer Clave API de Gemini', 'Por favor, introduce tu clave API de Gemini:', ui.ButtonSet.OK_CANCEL);

    if (response.getSelectedButton() == ui.Button.OK) {
        const apiKey = response.getResponseText();
        PropertiesService.getScriptProperties().setProperty(CONSTANTS.PROPERTIES.GEMINI_API_KEY, apiKey);
        ui.alert('Clave API Guardada', 'Tu clave API de Gemini ha sido guardada exitosamente.', ui.ButtonSet.OK);
    }
}

function generateEmailDraft(client, hours, total) {
    const apiKey = PropertiesService.getScriptProperties().getProperty(CONSTANTS.PROPERTIES.GEMINI_API_KEY);
    if (!apiKey) {
        throw new Error('La clave API de Gemini no ha sido establecida. Por favor, configúrala desde el menú de TimeBill Pro.');
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    };

    const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(requestBody)
    };

    try {
        const response = UrlFetchApp.fetch(apiUrl, options);
        const responseBody = JSON.parse(response.getContentText());
        return responseBody.candidates[0].content.parts[0].text;
    } catch (e) {
        Logger.log(`Error en generateEmailDraft: ${e.message}`);
        throw new Error('No se pudo generar el borrador de correo. ' + e.message);
    }
}

function deleteClient(clientId) {
    const sheet = getSpreadsheet().getSheetByName(CONSTANTS.SHEET_NAMES.CLIENTS);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const idIndex = headers.indexOf('ID');

    for (let i = 0; i < data.length; i++) {
        if (data[i][idIndex] === clientId) {
            sheet.deleteRow(i + 2);
            return true;
        }
    }
    throw new Error('Cliente no encontrado.');
}
