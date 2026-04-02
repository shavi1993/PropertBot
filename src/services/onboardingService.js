const userDao      = require('../dao/userDao');
const { sendText } = require('../utils/whatsapp');

// ─── STEP: ask_name ───────────────────────────────────────────────────────────

async function handleAskName(from, lower, originalText) {
  if (lower === 'hi' || lower === 'hello' || lower === 'start') {
    await sendText(from, '👋 Welcome to *PropertyBot*!\n\nWhat is your *full name*?');
    return;
  }

  const name = originalText.trim();
  await userDao.updateUser(from, { name, step: 'ask_contact' });
  await sendText(from, `Nice to meet you, *${name}*! 😊\n\nWhat is your *contact number*?`);
}

// ─── STEP: ask_contact ────────────────────────────────────────────────────────

async function handleAskContact(from, text) {
  const digits = text.replace(/\D/g, '');

  if (digits.length < 7) {
    await sendText(from, '⚠️ That doesn\'t look like a valid number. Please enter your *contact number* (digits only).');
    return;
  }

  await userDao.updateUser(from, { contact: digits, step: 'menu' });
  await sendText(from, '✅ All set! Send *Hi* anytime to see the menu.');
}

module.exports = { handleAskName, handleAskContact };