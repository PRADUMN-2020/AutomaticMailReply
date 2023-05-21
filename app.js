const express = require('express');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const port = 3000;

// Gmail API configuration
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

// Function to authorize and get access to Gmail API
async function authorize(authCode) {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
  );

  const { tokens } = await oAuth2Client.getToken(authCode);
  oAuth2Client.setCredentials(tokens);
  return oAuth2Client;
}

// Function to get the OAuth authorization URL
function getAuthUrl() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  return authUrl;
}

// Function to check for new emails and send them reply if they had never been replied earliear
async function checkEmails(auth) {
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
  });

  const messages = res.data.messages;
  if (messages && messages.length) {
    for (const message of messages) {
      const msg = await gmail.users.messages.get({ userId: 'me', id: message.id });
      const headers = msg.data.payload.headers;

      // Check if the email has no prior replies
      const replyHeader = headers.find((header) => header.name === 'In-Reply-To');
      if (!replyHeader) {
        // Send a reply
        const email = {
            raw: Buffer.from(
                'From: "Pradumn Prasad" <pradumnprasad883@gmail.com>\n' +
                'To: ' + headers.find((header) => header.name === 'From').value + '\n' +
                'Subject: Auto Reply\n' +
                '\n' +
                'This is an automated response. I am currently on vacation.'
              ).toString('base64')
        };

        await gmail.users.messages.send({ userId: 'me', resource: email });

        // Add a label to the email and move it to the label
        const labelName = 'Vacation Auto Reply';
        const label = await gmail.users.labels.list({ userId: 'me' });
        const existingLabel = label.data.labels.find((lbl) => lbl.name === labelName);

        if (existingLabel) {
          await gmail.users.messages.modify({
            userId: 'me',
            id: message.id,
            addLabelIds: [existingLabel.id],
          });
        } else {
          const newLabel = await gmail.users.labels.create({
            userId: 'me',
            resource: {
              name: labelName,
              labelListVisibility: 'labelShow',
              messageListVisibility: 'show',
            },
          });

          await gmail.users.messages.modify({
            userId: 'me',
            id: message.id,
            addLabelIds: [newLabel.data.id],
          });
        }

        console.log('Auto reply sent to:', headers.find((header) => header.name === 'From').value);
      }
    }
  }
}

// OAuth callback route
app.get('/oauth2callback', async (req, res) => {
  const authCode = req.query.code;
  try {
    const auth = await authorize(authCode);
    setInterval(async () => {
      await checkEmails(auth);
    },Math.floor(Math.random() * (45000 - 12000 + 1)) + 12000);
    res.send('Authorization successful. You can close this window now.');
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('An error occurred during authorization.');
  }
});

// Main function
async function main() {
  try {
    const authUrl = getAuthUrl();
    console.log('Authorize this app by visiting this URL:', authUrl);
  } catch (err) {
    console.error('Error:', err);
  }
}

// Run the app
main();

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});


/* Technologies Used: For building this app the technologies that I used are node,
 express, googleapi and environment variables.*/



/* Imporvements: This REST api can be deployed and configured such that it any 
user who want to use the auto reply service can get access and use this api. A
fronted can also be created such that it will contain the details of how to use
this api. */