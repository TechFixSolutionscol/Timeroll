# TimeBill Pro

TimeBill Pro is a simple and efficient web application for time tracking and invoicing, built with a vanilla HTML, JavaScript, and Tailwind CSS frontend, and powered by a Google Apps Script backend that uses a Google Sheet as its database.

## Features

-   **Time Tracking:** A simple timer to track your work sessions.
-   **Client Management:** Add, edit, and delete clients.
-   **Invoice Generation:** Automatically generate an invoice with the total amount based on your hourly rate.
-   **AI-Powered Email Drafts:** Generate professional email drafts for your invoices using the Gemini API.
-   **Dark Mode:** A comfortable dark mode for late-night work sessions.
-   **Data Persistence:** All your data is securely stored in a private Google Sheet.

## Setup Instructions

To get your own copy of TimeBill Pro up and running, follow these steps:

### 1. Create the Google Apps Script Project

1.  Go to [script.google.com](https://script.google.com) and create a new project.
2.  Copy the code from `Code.gs`, `index.html`, `styles.html`, and `scripts.html` into the corresponding files in your Apps Script project.
3.  In the Apps Script editor, go to **Project Settings** (the gear icon) and enable **"Show 'appsscript.json' manifest file in editor"**.

### 2. Set Up the Database

1.  In the Apps Script editor, select the `setupDatabase` function from the function dropdown and click **Run**.
2.  This will create a new Google Sheet named "TimeBill Pro Database" in your Google Drive and set up the necessary tables.
3.  It will also store the spreadsheet ID in the script properties, so the application can access it.

### 3. Configure Script Properties

1.  In the Apps Script editor, go to **Project Settings** and scroll down to **Script Properties**.
2.  Add a new property with the following key: `GEMINI_API_KEY`.
3.  Set the value to your Gemini API key. You can get one from [Google AI Studio](https://aistudio.google.com/).

### 4. Deploy the Web App

1.  In the Apps Script editor, click **Deploy** > **New deployment**.
2.  Select **Web app** as the deployment type.
3.  In the **Description** field, enter a name for your deployment (e.g., "v1").
4.  For **Who has access**, select **"Anyone with a Google account"** or **"Anyone"** depending on your needs.
5.  Click **Deploy**.

You will be given a URL for your web app. You can now use this URL to access your copy of TimeBill Pro.

## How to Use

1.  Open the web app URL.
2.  You will be prompted to log in (this is a demo, so no credentials are required).
3.  Go to the **Clients** page to add your clients.
4.  Go to the **Dashboard**, select a client, set your hourly rate, and start the timer.
5.  When you stop the timer, an invoice will be generated.
6.  You can then generate an email draft, send the invoice, or send it via WhatsApp.
