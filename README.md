# TimeBill Pro

TimeBill Pro is a web application for time tracking and invoicing, built with a vanilla HTML/CSS/JS frontend, and a Google Apps Script backend that uses Google Sheets as a database.

## Architecture

*   **Frontend**: Vanilla HTML, CSS (Tailwind CSS), and JavaScript.
*   **Backend**: Google Apps Script.
*   **Database**: Google Sheets.

The frontend is served by Google Apps Script, which also provides the API for interacting with the Google Sheet database.

## Setup Instructions

Follow these steps to set up and deploy your own instance of TimeBill Pro.

### 1. Create a Google Sheet

1.  Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet.
2.  Rename the spreadsheet to "TimeBill Pro DB".
3.  Create a sheet (tab) named `Clients`.
4.  Set up the following headers in the `Clients` sheet in the first row:
    *   `ID`
    *   `Name`
    *   `Email`
    *   `Phone`
    *   `Address`
5.  Create another sheet named `Users`.
6.  Set up the following headers in the `Users` sheet in the first row:
    *   `ID`
    *   `Name`
    *   `Email`
    *   `HashedPassword`
    *   `Salt`
7.  Take note of the spreadsheet ID from the URL. The ID is the long string of characters between `/d/` and `/edit`.

### 2. Create a Google Apps Script Project

1.  Go to [script.google.com](https://script.google.com) and create a new project.
2.  Give the project a name, like "TimeBill Pro".
3.  You will see a default `Code.gs` file.
4.  Create three new files by clicking the `+` icon in the editor:
    *   Select `HTML` and name the file `index`.
    *   Select `HTML` and name the file `styles`. This will create `styles.html`.
    *   Select `HTML` and name the file `scripts`. This will create `scripts.html`.

### 3. Copy the Code

1.  **`Code.gs`**: Copy the contents of the `Code.gs` file from this repository and paste it into your `Code.gs` file in the Apps Script editor.
2.  **`index.html`**: Copy the contents of `index.html` from this repository and paste it into your `index.html` file in the Apps Script editor.
3.  **`styles.html`**: Copy the contents of `styles.css` from this repository and paste it into your `styles.html` file.
4.  **`scripts.html`**: Copy the contents of `scripts.js` from this repository and paste it into your `scripts.html` file.

### 4. Configure Script Properties

Script properties are used to store sensitive information like your spreadsheet ID and API keys securely.

1.  In the Apps Script editor, go to **Project Settings** (the gear icon on the left).
2.  Under **Script Properties**, click **Add script property**.
3.  Add the following properties:
    *   **`SPREADSHEET_ID`**: The ID of your Google Sheet you copied earlier.
    *   **`GEMINI_API_KEY`**: Your API key for the Gemini API.

### 5. Deploy the Web App

1.  Click the **Deploy** button in the top right corner and select **New deployment**.
2.  Click the gear icon next to **Select type** and choose **Web app**.
3.  In the configuration, do the following:
    *   **Description**: "TimeBill Pro v1"
    *   **Execute as**: "Me"
    *   **Who has access**: "Anyone with Google account" (or "Anyone" if you want it to be public).
4.  Click **Deploy**.
5.  Authorize the script to access your Google Sheet data.
6.  Copy the **Web app URL**. This is the URL to your deployed TimeBill Pro application.

You can now access your instance of TimeBill Pro at the deployed URL.
