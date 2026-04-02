const userDao     = require('../dao/userDao');
const areaDao     = require('../dao/areaDao');
const propertyDao = require('../dao/propertyDao');
const { sendText, sendButtons, sendList } = require('../utils/whatsapp');
const CONST_KEY   = require('../utils/constKey');
const mongoose    = require('mongoose');

// ─── MAIN ROUTER ──────────────────────────────────────────────────────────────

async function handleBotFlow(from, waName, type, text, buttonId, message) {
  const lower = (text || '').toLowerCase().trim();

  const user = await userDao.findOrCreate(from);

  if (user.step === 'ask_name')       return handleAskName(from, lower, text);
  if (user.step === 'ask_contact')    return handleAskContact(from, text);

  if (user.step === 'list_type')      return handleListType(from, lower, buttonId);
  if (user.step === 'list_title')     return handleListTitle(from, text);
  if (user.step === 'list_area')      return handleListArea(from, lower, buttonId);
  if (user.step === 'list_area_page') return handleListAreaPage(from, lower, buttonId);
  if (user.step === 'list_price')     return handleListPrice(from, text);  // ← add this
  if (user.step === 'confirm_listing') return handleConfirmListing(from, buttonId);
  if (user.step === 'search_details') return handleSearchDetails(from, text);

  return handleMainMenu(from, user, lower, buttonId);
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────

async function handleAskName(from, lower, originalText) {
  if (lower === 'hi' || lower === 'hello' || lower === 'start') {
    await sendText(from, '👋 Welcome to *PropertyBot*!\n\nWhat is your *full name*?');
    return;
  }
  const name = originalText.trim();
  await userDao.updateUser(from, { name, step: 'ask_contact' });
  await sendText(from, `Nice to meet you, *${name}*! 😊\n\nWhat is your *contact number*?`);
}

async function handleAskContact(from, text) {
  const digits = text.replace(/\D/g, '');
  if (digits.length < 7) {
    await sendText(from, '⚠️ That doesn\'t look like a valid number. Please enter your *contact number* (digits only).');
    return;
  }
  await userDao.updateUser(from, { contact: digits, step: 'menu' });
  await sendText(from, '✅ All set! Send *Hi* anytime to see the menu.');
}

// ─── MAIN MENU ────────────────────────────────────────────────────────────────

async function handleMainMenu(from, user, lower, buttonId) {
  const isHi     = lower === 'hi' || lower === 'hello' || lower === 'start';
  const isList   = buttonId === 'list'   || lower === 'list'   || lower === 'list property';
  const isSearch = buttonId === 'search' || lower === 'search' || lower === 'buy' || lower === 'rent';

  if (isHi)     { await sendMenu(from, user.name); return; }
  if (isList)   { await startListFlow(from); return; }
  if (isSearch) { await startSearchFlow(from); return; }

  await sendText(from, 'Send *Hi* to see the menu, or choose:\n\n🏠 *List property*\n🔍 *Search property*');
}

async function sendMenu(to, name) {
  await sendButtons(
    to,
    `Hi *${name || 'there'}*! 👋 Welcome to PropertyBot.\n\nWhat would you like to do?`,
    [
      { id: 'list',   title: 'List property'   },
      { id: 'search', title: 'Search property' },
    ]
  );
}

// ─── LIST PROPERTY FLOW ───────────────────────────────────────────────────────

async function startListFlow(from) {
  await userDao.updateUser(from, { step: 'list_type', listingDraft: {} });
  await sendButtons(
    from,
    '🏠 Let\'s list your property!\n\nFirst, what are you offering?',
    [
      { id: 'type_rent', title: 'Rent 🔑' },
      { id: 'type_sale', title: 'Sale 💰' },
    ]
  );
}

// ── STEP 1 — Property type ────────────────────────────────────────────────────

async function handleListType(from, lower, buttonId) {
  let propertyType = null;

  if (buttonId === 'type_rent' || lower === 'rent') {
    propertyType = CONST_KEY.PROPERTY_TYPE.RENT;
  } else if (buttonId === 'type_sale' || lower === 'sale') {
    propertyType = CONST_KEY.PROPERTY_TYPE.SALE;
  }

  if (!propertyType) {
    await sendButtons(from, '⚠️ Please choose an option:', [
      { id: 'type_rent', title: 'Rent 🔑' },
      { id: 'type_sale', title: 'Sale 💰' },
    ]);
    return;
  }

  await userDao.updateUser(from, {
    step: 'list_title',
    'listingDraft.type': propertyType,
  });

  await sendText(
    from,
    `Got it — *${propertyType.toUpperCase()}* 👍\n\nNow, what is the *title* of your property?\n\n_Example: 3BHK Apartment`
  );
}

// ── STEP 2 — Title ────────────────────────────────────────────────────────────

async function handleListTitle(from, text) {
  const title = text.trim();
  if (!title) {
    await sendText(from, '⚠️ Title cannot be empty. Please enter a *property title*.');
    return;
  }

  await userDao.updateUser(from, {
    step: 'list_area',
    'listingDraft.title': title,
    'listingDraft.areaPage': 0,
  });

  await sendAreaPage(from, 0);
}

// ── STEP 3 — Area selection ───────────────────────────────────────────────────

const AREAS_PER_PAGE = 10;

async function sendAreaPage(from, pageIndex) {
  // Always fetch fresh — no caching in DB
  let areas = [];
  try {
    areas = await areaDao.getAllAreas();
  } catch (err) {
    console.error('Area fetch error:', err);
  }

  if (!areas || areas.length === 0) {
    await sendText(from, '⚠️ No areas found. Please try again later.');
    await userDao.updateUser(from, { step: 'menu' });
    return;
  }

  const totalPages = Math.ceil(areas.length / AREAS_PER_PAGE);
  const page       = Math.max(0, Math.min(pageIndex, totalPages - 1));
  const start      = page * AREAS_PER_PAGE;
  const pageAreas  = areas.slice(start, start + AREAS_PER_PAGE);

  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  const nextStep = (hasPrev || hasNext) ? 'list_area_page' : 'list_area';

  await userDao.updateUser(from, {
    step: nextStep,
    'listingDraft.areaPage': page,
  });

  const pageInfo = totalPages > 1 ? ` (page ${page + 1}/${totalPages})` : '';

  await sendList(
    from,
    `📍 Select your *area*${pageInfo}:`,
    'Choose area',
    [
      {
        title: 'Available Areas',
        rows: pageAreas.map(a => ({
          id:          a._id.toString(),
          title:       a.title.length > 24 ? a.title.substring(0, 21) + '...' : a.title,
          description: '',
        })),
      },
    ]
  );

  if (hasPrev || hasNext) {
    const navButtons = [];
    if (hasPrev) navButtons.push({ id: `area_prev__${page - 1}`, title: '◀ Previous' });
    if (hasNext) navButtons.push({ id: `area_next__${page + 1}`, title: 'Next ▶'    });
    await sendButtons(from, '_Navigate to see more areas:_', navButtons);
  }
}

// ── Prev / Next navigation ────────────────────────────────────────────────────

async function handleListAreaPage(from, lower, buttonId) {
  if (buttonId && buttonId.startsWith('area_prev__')) {
    const page = parseInt(buttonId.replace('area_prev__', ''), 10);
    await sendAreaPage(from, isNaN(page) ? 0 : page);
    return;
  }
  if (buttonId && buttonId.startsWith('area_next__')) {
    const page = parseInt(buttonId.replace('area_next__', ''), 10);
    await sendAreaPage(from, isNaN(page) ? 0 : page);
    return;
  }
  // Area row tapped while step was list_area_page
  return handleListArea(from, lower, buttonId);
}

// ── Area selected ─────────────────────────────────────────────────────────────

async function handleListArea(from, lower, buttonId) {
  const user  = await userDao.findOrCreate(from);
  const draft = user.listingDraft || {};

  if (!buttonId) {
    await sendText(from, '⚠️ Please tap one of the area options below.');
    await userDao.updateUser(from, { step: 'list_area' });
    await sendAreaPage(from, draft.areaPage || 0);
    return;
  }

  // Save area to draft, move to price step
  await userDao.updateUser(from, {
    step: 'list_price',
    'listingDraft.area': buttonId,
  });

  await sendText(
    from,
    `📍 *Area:* ${lower} ✅\n\nNow enter the *price*:\n\n` +
    `_For rent: monthly amount (e.g. 15000)_\n` +
    `_For sale: total amount (e.g. 5000000)_`
  );
}

//--------handle price 
async function handleListPrice(from, text) {
  const user  = await userDao.findOrCreate(from);
  const draft = user.listingDraft || {};

  const price = parseInt(text.replace(/[^0-9]/g, ''), 10);

  if (!price || price <= 0) {
    await sendText(from, '⚠️ Please enter a valid *price* (numbers only, e.g. 15000).');
    return;
  }

  // Save price in draft
  await userDao.updateUser(from, {
    step: 'confirm_listing',
    'listingDraft.price': price,
  });

  // Fetch area name if not already in draft
  let areaName = draft.areaName;
  if (!areaName) {
    try {
      const area = await areaDao.getAreaById(draft.area);
      areaName = area?.title || 'Unknown';
      await userDao.updateUser(from, { 'listingDraft.areaName': areaName });
    } catch (err) {
      console.error('Area fetch error:', err);
      areaName = 'Unknown';
    }
  }

  // Send property summary for confirmation
  await sendButtons(
    from,
    `✅ *Property Summary:*\n\n` +
    `📝 Title: ${draft.title}\n` +
    `🏷️ Type: ${draft.type.toUpperCase()}\n` +
    `📍 Area: ${areaName}\n` +
    `💰 Price: ₹${price.toLocaleString('en-IN')}\n\n` +
    `Do you want to submit this listing?`,
    [
      { id: 'confirm_yes', title: '✅ Yes' },
      { id: 'confirm_no',  title: '❌ No'  },
    ]
  );
}

// ─── handleConfirmListing ─────────────────────────────────────────────────────

async function handleConfirmListing(from, buttonId) {
  const user  = await userDao.findOrCreate(from);
  const draft = user.listingDraft || {};

  if (buttonId === 'confirm_yes') {
    try {
      await propertyDao.createProperty({
        title:         draft.title,
        type:          draft.type,
        area:          new mongoose.Types.ObjectId(draft.area),
        sellerId:      user._id,
        sellerContact: user.contact,
        price:         draft.price,
      });

      await sendText(
        from,
        `🎉 *Property listed successfully!*\n\n` +
        `📝 Title: ${draft.title}\n` +
        `🏷️ Type: ${draft.type.toUpperCase()}\n` +
        `📍 Area: ${draft.areaName}\n` +
        `💰 Price: ₹${draft.price.toLocaleString('en-IN')}\n\n` +
        `Our team will review and activate your listing shortly.\n\nSend *Hi* to return to the menu.`
      );

    } catch (err) {
      console.error('Property save error:', err);
      await sendText(from, '❌ Something went wrong saving your listing. Please try again.');
    }

  } else if (buttonId === 'confirm_no') {
    await sendText(from, '⚠️ Listing discarded. You can start again from the menu.');
  } else {
    // Fallback if user types something instead of pressing buttons
    await sendText(from, '⚠️ Please select ✅ Yes or ❌ No.');
    return;
  }

  // Reset user step and draft
  await userDao.updateUser(from, { step: 'menu', listingDraft: {} });
}
// ─── SEARCH PROPERTY FLOW ─────────────────────────────────────────────────────

async function startSearchFlow(from) {
  await userDao.updateUser(from, { step: 'search_details' });
  await sendText(
    from,
    '🔍 Let\'s find you a property!\n\nPlease share what you\'re looking for:\n\n' +
    '*Location*\n' +
    '*Budget* (e.g. ₹15,000–₹25,000/mo)\n' +
    '*Type* (buy / rent)\n' +
    '*Bedrooms*\n\n' +
    'Example: _Ludhiana, ₹20,000/mo, rent, 3 bedrooms_'
  );
}

async function handleSearchDetails(from, text) {
  await userDao.updateUser(from, { step: 'menu' });
  await sendText(from, `✅ Got it! We\'re searching for:\n_${text}_\n\nOur team will send you matching listings shortly.`);
}

module.exports = { handleBotFlow };