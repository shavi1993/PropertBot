const axios = require('axios');
const User = require('../models/User');

const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_ID = process.env.WA_PHONE_ID;
console.log('PHONE_ID value:', PHONE_ID);

// ─── BOT FLOW ROUTER ───────────────────────────────────
exports.handleBotFlow = async (from, waName, type, text, message) => {
  const lower = text.toLowerCase();

  let user = await User.findOne({ waId: from });
  if (!user) user = await User.create({ waId: from, step: 'ask_name' });

  // ── Step: collect name ──────────────────────────────
  if (user.step === 'ask_name') {
    // First ever message — kick off onboarding
    if (lower === 'hi' || lower === 'hello' || lower === 'start') {
      await sendWhatsApp(from, {
        type: 'text',
        text: { body: `👋 Welcome! What is your *full name*?` }
      });
      return;
    }
    // Any other text = they're answering the name question
    await User.updateOne({ waId: from }, { name: text, step: 'ask_contact' });
    await sendWhatsApp(from, {
      type: 'text',
      text: { body: `Nice to meet you, *${text}*! 😊\n\nWhat is your *contact number*?` }
    });
    return;
  }

  // ── Step: collect contact ───────────────────────────
  if (user.step === 'ask_contact') {
    await User.updateOne({ waId: from }, { contact: text, step: null });
    await sendWhatsApp(from, {
      type: 'text',
      text: { body: `✅ Got it! Send *Hi* to see the menu.` }
    });
    return;
  }

  // ── Onboarding complete — main menu routing ─────────
  if (lower === 'hi' || lower === 'hello' || lower === 'start') {
    await sendMenu(from, user.name);

  } else if (lower === 'list' || lower === 'list property') {
    await handleListProperty(from);

  } else if (lower === 'search' || lower === 'buy' || lower === 'rent') {
    await handleSearch(from);

  } else {
    await sendWhatsApp(from, {
      type: 'text',
      text: { body: 'Send *Hi* to start or choose:\n\n1. List property\n2. Search property' }
    });
  }
};

// ─── PROPERTY ACTIONS ──────────────────────────────────
async function handleListProperty(from) {
  // TODO: send property listing form / questions
  await sendWhatsApp(from, {
    type: 'text',
    text: { body: '🏠 Let\'s list your property! Please share the *property details* (type, location, price, bedrooms).' }
  });
}

async function handleSearch(from) {
  // TODO: send search filters
  await sendWhatsApp(from, {
    type: 'text',
    text: { body: '🔍 What are you looking for? Share *location, budget, and type* (buy/rent).' }
  });
}

// ─── SEND MENU WITH BUTTONS ────────────────────────────
async function sendMenu(to, name) {
  await sendWhatsApp(to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: `Hi ${name || 'there'}! Welcome to PropertyBot.\n\nWhat would you like to do?`
      },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'list', title: 'List property' } },
          { type: 'reply', reply: { id: 'search', title: 'Search property' } }
        ]
      }
    }
  });
}

// ─── SEND WHATSAPP MESSAGE ─────────────────────────────
async function sendWhatsApp(to, body) {
  try {
    await axios.post(
      `https://graph.facebook.com/v22.0/${PHONE_ID}/messages`,
      { messaging_product: 'whatsapp', to, ...body },
      { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Send error:', err.response?.data || err.message);
  }
}