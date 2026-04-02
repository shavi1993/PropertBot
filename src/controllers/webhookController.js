const botService = require('../services/botservice');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// ─── VERIFY WEBHOOK (GET) ─────────────────────────────────────────────────────

exports.verifyWebhook = (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] Verified successfully');
    return res.status(200).send(challenge);
  }

  console.error('[Webhook] Verification failed — token mismatch');
  res.sendStatus(403);
};

// ─── HANDLE INCOMING MESSAGES (POST) ─────────────────────────────────────────

exports.handleMessage = async (req, res) => {
  // Always respond 200 immediately so WhatsApp doesn't retry
  res.sendStatus(200);

  try {
    const entry   = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;

    // Ignore non-message events (status updates, reactions, etc.)
    const messages = value?.messages;
    if (!messages || messages.length === 0) return;

    const message = messages[0];
    const from    = message.from;
    const waName  = value?.contacts?.[0]?.profile?.name || 'there';
    const type    = message.type;

    // Resolve text for all supported message types
    const text =
      message?.text?.body?.trim() ||
      message?.interactive?.button_reply?.title?.trim() ||
      message?.interactive?.list_reply?.title?.trim() ||
      '';

    // Reliable button ID for menu routing (avoids title-string fragility)
    const buttonId =
      message?.interactive?.button_reply?.id?.trim() ||
      message?.interactive?.list_reply?.id?.trim() ||
      '';

    // Skip unsupported types (images, audio, stickers, etc.)
    if (!text && !buttonId) {
      console.log(`[Webhook] Unsupported message type "${type}" from ${from} — skipping`);
      return;
    }

    console.log(`[Webhook] Message from ${waName} (${from}) | type: ${type} | text: "${text}" | buttonId: "${buttonId}"`);

    await botService.handleBotFlow(from, waName, type, text, buttonId, message);

  } catch (err) {
    console.error('[Webhook] Unhandled error:', err.message, err.stack);
  }
};