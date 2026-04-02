const axios = require('axios');

const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_ID = process.env.WA_PHONE_ID;

/**
 * Send a WhatsApp message via the Cloud API.
 * @param {string} to   - Recipient WhatsApp number (e.g. "6512345678")
 * @param {object} body - Message payload (type + content fields)
 */
async function sendWhatsApp(to, body) {
  try {
    await axios.post(
      `https://graph.facebook.com/v22.0/${PHONE_ID}/messages`,
      { messaging_product: 'whatsapp', to, ...body },
      {
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    console.error('[sendWhatsApp] Error:', err.response?.data || err.message);
    throw err; // re-throw so callers know the message failed
  }
}

/**
 * Send a plain text message.
 */
async function sendText(to, text) {
  return sendWhatsApp(to, {
    type: 'text',
    text: { body: text },
  });
}

/**
 * Send an interactive button menu.
 * @param {string}   to      - Recipient
 * @param {string}   bodyText - Body text
 * @param {Array}    buttons  - [{ id, title }]
 */
async function sendButtons(to, bodyText, buttons) {
  return sendWhatsApp(to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
}

async function sendList(to, bodyText, buttonLabel, sections) {
  return sendWhatsApp(to, {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonLabel,
        sections,
      },
    },
  });
}

module.exports = { sendWhatsApp, sendText, sendButtons ,sendList};