const userDao                        = require('../dao/userDao');
const areaDao                        = require('../dao/areaDao');
const propertyDao                    = require('../dao/propertyDao');
const { sendText, sendButtons,
        sendList }                   = require('../utils/whatsapp');
const CONST_KEY                      = require('../utils/constKey');
const mongoose                       = require('mongoose');

const AREAS_PER_PAGE = 10;

// ═════════════════════════════════════════════════════════════════════════════
//  LIST FLOW  →  list_type → list_title → list_area → list_price → confirm
// ═════════════════════════════════════════════════════════════════════════════

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

// ── STEP: list_type ───────────────────────────────────────────────────────────

async function handleListType(from, lower, buttonId) {
  let propertyType = null;

  if (buttonId === 'type_rent' || lower === 'rent') propertyType = CONST_KEY.PROPERTY_TYPE.RENT;
  if (buttonId === 'type_sale' || lower === 'sale') propertyType = CONST_KEY.PROPERTY_TYPE.SALE;

  if (!propertyType) {
    await sendButtons(from, '⚠️ Please choose an option:', [
      { id: 'type_rent', title: 'Rent 🔑' },
      { id: 'type_sale', title: 'Sale 💰' },
    ]);
    return;
  }

  await userDao.updateUser(from, { step: 'list_title', 'listingDraft.type': propertyType });
  await sendText(
    from,
    `Got it — *${propertyType.toUpperCase()}* 👍\n\nNow, what is the *title* of your property?\n\n_Example: 3BHK Apartment_`
  );
}

// ── STEP: list_title ──────────────────────────────────────────────────────────

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

// ── STEP: list_area — page display ────────────────────────────────────────────

async function sendAreaPage(from, pageIndex) {
  let areas = [];
  try {
    areas = await areaDao.getAllAreas();
  } catch (err) {
    console.error('[listingService] Area fetch error:', err);
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
  const hasPrev    = page > 0;
  const hasNext    = page < totalPages - 1;

  await userDao.updateUser(from, {
    step: (hasPrev || hasNext) ? 'list_area_page' : 'list_area',
    'listingDraft.areaPage': page,
  });

  const pageInfo = totalPages > 1 ? ` (page ${page + 1}/${totalPages})` : '';

  await sendList(
    from,
    `📍 Select your *area*${pageInfo}:`,
    'Choose area',
    [{
      title: 'Available Areas',
      rows: pageAreas.map(a => ({
        id:          a._id.toString(),
        title:       a.title.length > 24 ? a.title.substring(0, 21) + '...' : a.title,
        description: '',
      })),
    }]
  );

  if (hasPrev || hasNext) {
    const navButtons = [];
    if (hasPrev) navButtons.push({ id: `area_prev__${page - 1}`, title: '◀ Previous' });
    if (hasNext) navButtons.push({ id: `area_next__${page + 1}`, title: 'Next ▶'    });
    await sendButtons(from, '_Navigate to see more areas:_', navButtons);
  }
}

// ── STEP: list_area_page — prev/next nav ──────────────────────────────────────

async function handleListAreaPage(from, lower, buttonId) {
  if (buttonId?.startsWith('area_prev__')) {
    const page = parseInt(buttonId.replace('area_prev__', ''), 10);
    await sendAreaPage(from, isNaN(page) ? 0 : page);
    return;
  }
  if (buttonId?.startsWith('area_next__')) {
    const page = parseInt(buttonId.replace('area_next__', ''), 10);
    await sendAreaPage(from, isNaN(page) ? 0 : page);
    return;
  }
  return handleListArea(from, lower, buttonId);
}

// ── STEP: list_area — area selected ───────────────────────────────────────────

async function handleListArea(from, lower, buttonId) {
  const user  = await userDao.findOrCreate(from);
  const draft = user.listingDraft || {};

  if (!buttonId) {
    await sendText(from, '⚠️ Please tap one of the area options below.');
    await userDao.updateUser(from, { step: 'list_area' });
    await sendAreaPage(from, draft.areaPage || 0);
    return;
  }

  await userDao.updateUser(from, { step: 'list_price', 'listingDraft.area': buttonId });
  await sendText(
    from,
    `📍 *Area selected* ✅\n\nNow enter the *price*:\n\n` +
    `_For rent: monthly amount (e.g. 15000)_\n` +
    `_For sale: total amount (e.g. 5000000)_`
  );
}

// ── STEP: list_price ──────────────────────────────────────────────────────────

async function handleListPrice(from, text) {
  const user  = await userDao.findOrCreate(from);
  const draft = user.listingDraft || {};

  const price = parseInt(text.replace(/[^0-9]/g, ''), 10);
  if (!price || price <= 0) {
    await sendText(from, '⚠️ Please enter a valid *price* (numbers only, e.g. 15000).');
    return;
  }

  let areaName = draft.areaName;
  if (!areaName) {
    try {
      const area = await areaDao.getAreaById(draft.area);
      areaName = area?.title || 'Unknown';
    } catch (err) {
      console.error('[listingService] Area fetch error:', err);
      areaName = 'Unknown';
    }
  }

  await userDao.updateUser(from, {
    step: 'confirm_listing',
    'listingDraft.price': price,
    'listingDraft.areaName': areaName,
  });

  await sendButtons(
    from,
    buildSummary(draft.title, draft.type, areaName, price) +
    '\n\nDo you want to submit this listing?',
    [
      { id: 'confirm_yes', title: '✅ Yes, Submit' },
      { id: 'confirm_no',  title: '❌ No, Discard' },
    ]
  );
}

// ── STEP: confirm_listing ─────────────────────────────────────────────────────

async function handleConfirmListing(from, buttonId) {
  const user  = await userDao.findOrCreate(from);
  const draft = user.listingDraft || {};

  if (buttonId === 'confirm_yes') {
    if (!draft.title || !draft.type || !draft.area || !draft.price) {
      await sendText(from, '⚠️ Some details are missing. Please start again.');
      await userDao.updateUser(from, { step: 'menu', listingDraft: {} });
      return;
    }

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
        buildSummary(draft.title, draft.type, draft.areaName, draft.price) +
        `\n\nOur team will review and activate it shortly.\n\nSend *Hi* to return to the menu.`
      );
    } catch (err) {
      console.error('[listingService] Save error:', err);
      await sendText(from, '❌ Something went wrong. Please try again.');
    }

  } else if (buttonId === 'confirm_no') {
    await sendText(from, '⚠️ Listing discarded. Send *Hi* to start again.');

  } else {
    await sendButtons(from, '⚠️ Please select an option:', [
      { id: 'confirm_yes', title: '✅ Yes, Submit' },
      { id: 'confirm_no',  title: '❌ No, Discard' },
    ]);
    return;
  }

  await userDao.updateUser(from, { step: 'menu', listingDraft: {} });
}

// ═════════════════════════════════════════════════════════════════════════════
//  MY LISTINGS  —  shows only ACTIVE properties
// ═════════════════════════════════════════════════════════════════════════════

async function startMyListingsFlow(from) {
  const user = await userDao.findOrCreate(from);

  let listings = [];
  try {
    listings = await propertyDao.getPropertiesBySeller(user._id);
  } catch (err) {
    console.error('[listingService] Fetch listings error:', err);
  }

  if (!listings || listings.length === 0) {
    await sendText(from, '📭 You have no active listings.\n\nSend *Hi* to return to the menu.');
    return;
  }

  await userDao.updateUser(from, { step: 'my_listings', actionDraft: {} });

  await sendList(
    from,
    '🏠 *Your Active Listings* — tap one to manage:',
    'Choose listing',
    [{
      title: 'Active Listings',
      rows: listings.map(p => ({
        id:          p._id.toString(),
        title:       p.title.length > 24 ? p.title.substring(0, 21) + '...' : p.title,
        description: `₹${p.price.toLocaleString('en-IN')} · ${p.type.toUpperCase()}`,
      })),
    }]
  );
}

// ── STEP: my_listings — user tapped a listing ─────────────────────────────────

async function handleMyListings(from, buttonId) {
  if (!buttonId) {
    await sendText(from, '⚠️ Please tap a listing from the list above.');
    return;
  }

  await userDao.updateUser(from, {
    step:        'listing_action',
    actionDraft: { propertyId: buttonId },
  });

  await sendButtons(
    from,
    '⚙️ What would you like to do with this listing?',
    [
      { id: 'action_edit',   title: '✏️ Edit'   },
      { id: 'action_delete', title: '🗑️ Delete' },
    ]
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  EDIT FLOW  →  listing_action → edit_title → edit_price → confirm_edit
//
//  Flow:
//    1. User taps Edit
//    2. Bot asks for new title — shows [✏️ New Title] [⏭️ Skip Title] buttons
//    3a. User taps "New Title" → bot asks them to type it → saves → goes to price step
//    3b. User taps "Skip Title" → goes straight to price step
//    4. Bot asks for new price — shows [✏️ New Price] [⏭️ Skip Price] buttons
//    5a. User taps "New Price" → bot asks them to type it → saves → shows confirm
//    5b. User taps "Skip Price" → shows confirm with only title change
//    6. User confirms → DB updated
// ═════════════════════════════════════════════════════════════════════════════

async function handleListingAction(from, buttonId) {
  const user  = await userDao.findOrCreate(from);
  const draft = user.actionDraft || {};

  if (!draft.propertyId) {
    await sendText(from, '⚠️ Something went wrong. Please send *Hi* and try again.');
    await userDao.updateUser(from, { step: 'menu', actionDraft: {} });
    return;
  }

  if (buttonId === 'action_edit') {
    await userDao.updateUser(from, {
      step:        'edit_title',
      actionDraft: { propertyId: draft.propertyId, newTitle: undefined, newPrice: undefined },
    });

    await sendButtons(
      from,
      '✏️ *Edit Listing*\n\nWould you like to update the *title*?',
      [
        { id: 'edit_title_yes',  title: '✏️ New Title' },
        { id: 'edit_title_skip', title: '⏭️ Skip'      },
      ]
    );

  } else if (buttonId === 'action_delete') {
    await userDao.updateUser(from, {
      step:        'delete_confirm',
      actionDraft: { propertyId: draft.propertyId },
    });

    await sendButtons(
      from,
      '🗑️ Are you sure you want to *delete* this listing?\n\n⚠️ This cannot be undone.',
      [
        { id: 'delete_yes', title: '🗑️ Yes, Delete' },
        { id: 'delete_no',  title: '❌ No, Keep it' },
      ]
    );

  } else {
    await sendButtons(from, '⚠️ Please choose an option:', [
      { id: 'action_edit',   title: '✏️ Edit'   },
      { id: 'action_delete', title: '🗑️ Delete' },
    ]);
  }
}

// ── STEP: edit_title ──────────────────────────────────────────────────────────
// Sub-states controlled by actionDraft.awaitingTitleInput flag:
//   false/undefined → user sees the Yes/Skip buttons
//   true            → user is typing the new title

async function handleEditTitle(from, text, buttonId) {
  const user  = await userDao.findOrCreate(from);
  const draft = user.actionDraft || {};

  if (!draft.propertyId) {
    await sendText(from, '⚠️ Something went wrong. Please send *Hi* and try again.');
    await userDao.updateUser(from, { step: 'menu', actionDraft: {} });
    return;
  }

  // ── User tapped "New Title" → ask them to type it ─────────────────────────
  if (buttonId === 'edit_title_yes') {
    await userDao.updateUser(from, {
      step:        'edit_title',
      actionDraft: { ...draft, awaitingTitleInput: true },
    });
    await sendText(from, '📝 Please type the *new title* for your property:');
    return;
  }

  // ── User tapped "Skip" → move to price step with no title change ──────────
  if (buttonId === 'edit_title_skip') {
    await userDao.updateUser(from, {
      step:        'edit_price',
      actionDraft: { ...draft, newTitle: null, awaitingTitleInput: false },
    });
    await sendButtons(
      from,
      '💰 Would you like to update the *price*?',
      [
        { id: 'edit_price_yes',  title: '✏️ New Price' },
        { id: 'edit_price_skip', title: '⏭️ Skip'      },
      ]
    );
    return;
  }

  // ── User typed the new title ──────────────────────────────────────────────
  if (draft.awaitingTitleInput) {
    const newTitle = text.trim();
    if (!newTitle) {
      await sendText(from, '⚠️ Title cannot be empty. Please type the *new title*:');
      return;
    }

    await userDao.updateUser(from, {
      step:        'edit_price',
      actionDraft: { ...draft, newTitle, awaitingTitleInput: false },
    });

    await sendButtons(
      from,
      `✅ Title noted: _${newTitle}_\n\n💰 Would you like to update the *price*?`,
      [
        { id: 'edit_price_yes',  title: '✏️ New Price' },
        { id: 'edit_price_skip', title: '⏭️ Skip'      },
      ]
    );
    return;
  }

  // ── Fallback: re-show the title buttons ───────────────────────────────────
  await sendButtons(
    from,
    '✏️ Would you like to update the *title*?',
    [
      { id: 'edit_title_yes',  title: '✏️ New Title' },
      { id: 'edit_title_skip', title: '⏭️ Skip'      },
    ]
  );
}

// ── STEP: edit_price ──────────────────────────────────────────────────────────
// Sub-states controlled by actionDraft.awaitingPriceInput flag:
//   false/undefined → user sees the Yes/Skip buttons
//   true            → user is typing the new price

async function handleEditPrice(from, text, buttonId) {
  const user  = await userDao.findOrCreate(from);
  const draft = user.actionDraft || {};

  if (!draft.propertyId) {
    await sendText(from, '⚠️ Something went wrong. Please send *Hi* and try again.');
    await userDao.updateUser(from, { step: 'menu', actionDraft: {} });
    return;
  }

  // ── User tapped "New Price" → ask them to type it ─────────────────────────
  if (buttonId === 'edit_price_yes') {
    await userDao.updateUser(from, {
      step:        'edit_price',
      actionDraft: { ...draft, awaitingPriceInput: true },
    });
    await sendText(from, '💰 Please type the *new price* (numbers only, e.g. 15000):');
    return;
  }

  // ── User tapped "Skip" → go straight to confirm ───────────────────────────
  if (buttonId === 'edit_price_skip') {
    // Both skipped — nothing to update
    if (!draft.newTitle) {
      await sendText(from, '⚠️ Nothing to update. Send *Hi* to return to the menu.');
      await userDao.updateUser(from, { step: 'menu', actionDraft: {} });
      return;
    }

    await userDao.updateUser(from, {
      step:        'confirm_edit',
      actionDraft: { ...draft, newPrice: null, awaitingPriceInput: false },
    });

    await sendButtons(
      from,
      buildEditSummary(draft.newTitle, null),
      [
        { id: 'edit_yes', title: '✅ Confirm' },
        { id: 'edit_no',  title: '❌ Cancel'  },
      ]
    );
    return;
  }

  // ── User typed the new price ──────────────────────────────────────────────
  if (draft.awaitingPriceInput) {
    const newPrice = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!newPrice || newPrice <= 0) {
      await sendText(from, '⚠️ Please enter a valid *price* (numbers only, e.g. 15000):');
      return;
    }

    await userDao.updateUser(from, {
      step:        'confirm_edit',
      actionDraft: { ...draft, newPrice, awaitingPriceInput: false },
    });

    await sendButtons(
      from,
      buildEditSummary(draft.newTitle, newPrice),
      [
        { id: 'edit_yes', title: '✅ Confirm' },
        { id: 'edit_no',  title: '❌ Cancel'  },
      ]
    );
    return;
  }

  // ── Fallback: re-show the price buttons ───────────────────────────────────
  await sendButtons(
    from,
    '💰 Would you like to update the *price*?',
    [
      { id: 'edit_price_yes',  title: '✏️ New Price' },
      { id: 'edit_price_skip', title: '⏭️ Skip'      },
    ]
  );
}

// ── STEP: confirm_edit ────────────────────────────────────────────────────────

async function handleConfirmEdit(from, buttonId) {
  const user  = await userDao.findOrCreate(from);
  const draft = user.actionDraft || {};

  if (buttonId === 'edit_yes') {
    if (!draft.propertyId || (!draft.newTitle && !draft.newPrice)) {
      await sendText(from, '⚠️ Nothing to update. Please send *Hi* and try again.');
      await userDao.updateUser(from, { step: 'menu', actionDraft: {} });
      return;
    }

    const propertyObjectId = mongoose.Types.ObjectId.isValid(draft.propertyId)
      ? new mongoose.Types.ObjectId(draft.propertyId.toString())
      : null;

    if (!propertyObjectId) {
      await sendText(from, '⚠️ Invalid property ID. Please send *Hi* and try again.');
      await userDao.updateUser(from, { step: 'menu', actionDraft: {} });
      return;
    }

    const updatePayload = {};
    if (draft.newTitle) updatePayload.title = draft.newTitle;
    if (draft.newPrice) updatePayload.price = draft.newPrice;

    console.log('[handleConfirmEdit] propertyId:', draft.propertyId);
    console.log('[handleConfirmEdit] payload:',    updatePayload);

    try {
      await propertyDao.updateProperty(propertyObjectId, updatePayload);

      // ── Fetch updated property and show full details ──────────────────────
      const updated  = await propertyDao.getPropertyById(propertyObjectId);
      const areaName = updated?.area?.title       // if area is populated
                    || updated?.areaName
                    || '—';

      await sendText(
        from,
        `✅ *Property updated successfully!*\n\n` +
        buildSummary(updated.title, updated.type, areaName, updated.price) +
        `\n\nSend *Hi* to return to the menu.`
      );

    } catch (err) {
      console.error('[listingService] Update error:', err);
      await sendText(from, '❌ Something went wrong. Please try again.');
    }

  } else if (buttonId === 'edit_no') {
    await sendText(from, '⚠️ Edit cancelled. Send *Hi* to return to the menu.');

  } else {
    await sendButtons(from, '⚠️ Please choose an option:', [
      { id: 'edit_yes', title: '✅ Confirm' },
      { id: 'edit_no',  title: '❌ Cancel'  },
    ]);
    return;
  }

  await userDao.updateUser(from, { step: 'menu', actionDraft: {} });
}

// ═════════════════════════════════════════════════════════════════════════════
//  DELETE FLOW  →  delete_confirm
//  Soft delete: sets property_status = 'deleted'
// ═════════════════════════════════════════════════════════════════════════════

async function handleDeleteConfirm(from, buttonId) {
  const user  = await userDao.findOrCreate(from);
  const draft = user.actionDraft || {};

  if (buttonId === 'delete_yes') {
    if (!draft.propertyId) {
      await sendText(from, '⚠️ Something went wrong. Please send *Hi* and try again.');
      await userDao.updateUser(from, { step: 'menu', actionDraft: {} });
      return;
    }

    const propertyObjectId = mongoose.Types.ObjectId.isValid(draft.propertyId)
      ? new mongoose.Types.ObjectId(draft.propertyId.toString())
      : null;

    if (!propertyObjectId) {
      await sendText(from, '⚠️ Invalid property ID. Please send *Hi* and try again.');
      await userDao.updateUser(from, { step: 'menu', actionDraft: {} });
      return;
    }

    try {
      await propertyDao.deleteProperty(propertyObjectId);
      await sendText(
        from,
        '🗑️ Your listing has been *deleted*.\n\nIt will no longer appear in your active listings.\n\nSend *Hi* to return to the menu.'
      );
    } catch (err) {
      console.error('[listingService] Delete error:', err);
      await sendText(from, '❌ Something went wrong. Please try again.');
    }

  } else if (buttonId === 'delete_no') {
    await sendText(from, '👍 Listing kept. Send *Hi* to return to the menu.');

  } else {
    await sendButtons(from, '⚠️ Please choose an option:', [
      { id: 'delete_yes', title: '🗑️ Yes, Delete' },
      { id: 'delete_no',  title: '❌ No, Keep it' },
    ]);
    return;
  }

  await userDao.updateUser(from, { step: 'menu', actionDraft: {} });
}

// ═════════════════════════════════════════════════════════════════════════════
//  SHARED HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function buildSummary(title, type, areaName, price) {
  return (
    `✅ *Property Summary:*\n\n` +
    `📝 Title:  ${title    || '—'}\n` +
    `🏷️  Type:   ${type     ? type.toUpperCase() : '—'}\n` +
    `📍 Area:   ${areaName || '—'}\n` +
    `💰 Price:  ₹${price   ? price.toLocaleString('en-IN') : '—'}`
  );
}

function buildEditSummary(newTitle, newPrice) {
  const lines = ['✏️ *Confirm the following updates:*\n'];
  if (newTitle) lines.push(`📝 Title:  _${newTitle}_`);
  if (newPrice) lines.push(`💰 Price:  _₹${newPrice.toLocaleString('en-IN')}_`);
  lines.push('\nProceed?');
  return lines.join('\n');
}

module.exports = {
  startListFlow,
  handleListType,
  handleListTitle,
  handleListArea,
  handleListAreaPage,
  handleListPrice,
  handleConfirmListing,
  startMyListingsFlow,
  handleMyListings,
  handleListingAction,
  handleEditTitle,
  handleEditPrice,
  handleConfirmEdit,
  handleDeleteConfirm,
};