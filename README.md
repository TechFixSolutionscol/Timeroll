# TimeBill Pro

TimeBill Pro is a simple time tracking and invoicing application built with HTML, Tailwind CSS, and Google Apps Script. It uses a Google Sheet as a database to store client and user information.

## Setup

1.  **Create a Google Sheet:**
    *   Create a new Google Sheet.
    *   Copy the Sheet ID from the URL (e.g., `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`).

2.  **Create a Google Apps Script:**
    *   Go to [script.google.com](https://script.google.com) and create a new project.
    *   Copy the code from `Code.gs`, `index.html`, `scripts.js`, and `styles.css` into the corresponding files in the Apps Script editor.
    *   In `Code.gs`, replace `"YOUR_SPREADSHEET_ID"` with the ID of your Google Sheet.

3.  **Set the Gemini API Key:**
    *   In the Apps Script editor, go to `Project Settings` > `Script Properties`.
    *   Add a new property with the name `GEMINI_API_KEY` and your Gemini API key as the value.

4.  **Deploy the application:**
    *   Click `Deploy` > `New deployment`.
    *   Select `Web app` as the deployment type.
    *   Configure the web app with the following settings:
        *   `Execute as`: `Me`
        *   `Who has access`: `Anyone with Google account` (or `Anyone` for public access).
    *   Click `Deploy`.
    *   Copy the web app URL.

## Usage

*   Open the web app URL in your browser.
*   The first time you open the app, click the "Create Tables" button to set up the necessary sheets in your Google Sheet.
*   Create a user account.
*   Log in to the application.
*   Add clients in the "Clients" section.
*   Track your time in the "Dashboard" section.
*   Generate invoices and email drafts.
