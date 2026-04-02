const userDao                       = require('../dao/userDao');
const areaDao                       = require('../dao/areaDao');
const propertyDao                   = require('../dao/propertyDao');
const { sendText, sendButtons,
        sendList }                  = require('../utils/whatsapp');
const CONST_KEY                     = require('../utils/constKey');

const AREAS_PER_PAGE = 10;
const mongoose                       = require('mongoose');

// ═════════════════════════════════════════════════════════════════════════════
//  SEARCH FLOW  →  search_type → search_area → results
// ═════════════════════════════════════════════════════════════════════════════

async function startSearchFlow(from) {
  await userDao.updateUser(from, { step: 'search_type', searchDraft: {} });
  await sendButtons(
    from,
    '🔍 Let\'s find you a property!\n\nWhat are you looking for?',
    [
      { id: 'search_buy',  title: '💰 Buy'  },
      { id: 'search_rent', title: '🔑 Rent' },
    ]
  );
}

// ── STEP: search_type ─────────────────────────────────────────────────────────

async function handleSearchType(from, buttonId) {
  let propertyType = null;

  if (buttonId === 'search_buy')  propertyType = CONST_KEY.PROPERTY_TYPE.SALE;
  if (buttonId === 'search_rent') propertyType = CONST_KEY.PROPERTY_TYPE.RENT;

  if (!propertyType) {
    await sendButtons(from, '⚠️ Please choose an option:', [
      { id: 'search_buy',  title: '💰 Buy'  },
      { id: 'search_rent', title: '🔑 Rent' },
    ]);
    return;
  }

  // ✅ Save as full object instead of dot-notation
  await userDao.updateUser(from, {
    step:        'search_area',
    searchDraft: { type: propertyType, areaPage: 0 },
  });

  await sendSearchAreaPage(from, 0);
}

// ── STEP: search_area — page display ─────────────────────────────────────────

async function sendSearchAreaPage(from, pageIndex) {
  let areas = [];
  try {
    areas = await areaDao.getAllAreas();
  } catch (err) {
    console.error('[searchService] Area fetch error:', err);
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
    step: (hasPrev || hasNext) ? 'search_area_page' : 'search_area',
    'searchDraft.areaPage': page,
  });

  const pageInfo = totalPages > 1 ? ` (page ${page + 1}/${totalPages})` : '';

  await sendList(
    from,
    `📍 Select an *area* to search in${pageInfo}:`,
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
    if (hasPrev) navButtons.push({ id: `sarea_prev__${page - 1}`, title: '◀ Previous' });
    if (hasNext) navButtons.push({ id: `sarea_next__${page + 1}`, title: 'Next ▶'    });
    await sendButtons(from, '_Navigate to see more areas:_', navButtons);
  }
}

// ── STEP: search_area_page — prev/next nav ────────────────────────────────────

async function handleSearchAreaPage(from, buttonId) {
  if (buttonId?.startsWith('sarea_prev__')) {
    const page = parseInt(buttonId.replace('sarea_prev__', ''), 10);
    await sendSearchAreaPage(from, isNaN(page) ? 0 : page);
    return;
  }
  if (buttonId?.startsWith('sarea_next__')) {
    const page = parseInt(buttonId.replace('sarea_next__', ''), 10);
    await sendSearchAreaPage(from, isNaN(page) ? 0 : page);
    return;
  }
  return handleSearchArea(from, buttonId);
}

// ── STEP: search_area — area selected, run query, show results ────────────────

async function handleSearchArea(from, buttonId) {
  const user  = await userDao.findOrCreate(from);
  const draft = user.searchDraft || {};
  console.log('[handleSearchArea] full user:', JSON.stringify(user, null, 2));
  console.log('[handleSearchArea] searchDraft:', JSON.stringify(draft, null, 2));
  console.log('[handleSearchArea] buttonId (areaId):', buttonId);
  console.log('[handleSearchArea] draft.type:', draft.type);
  console.log('[handleSearchArea] ACTIVE status:', CONST_KEY.PROPERTY_STATUS.ACTIVE);

  if (!buttonId) {
    await sendText(from, '⚠️ Please tap one of the area options below.');
    await sendSearchAreaPage(from, draft.areaPage || 0);
    return;
  }

  // Fetch area name for display
  let areaName = '—';
  try {
    const area = await areaDao.getAreaById(buttonId);
    areaName   = area?.title || '—';
  } catch (err) {
    console.error('[searchService] Area fetch error:', err);
  }

  // Query active properties matching type + area
  let listings = [];
  try {
    listings = await propertyDao.searchProperties({
      type:   draft.type,                        // 'rent' or 'sale'
      area:   buttonId,                          // area ObjectId string
      status: CONST_KEY.PROPERTY_STATUS.ACTIVE,  // 'active'
    });
  } catch (err) {
    console.error('[searchService] Search error:', err);
  }

  // Reset step to menu regardless of results
  await userDao.updateUser(from, { step: 'menu', searchDraft: {} });

  if (!listings || listings.length === 0) {
    await sendText(
      from,
      `🔍 No active *${draft.type?.toUpperCase()}* listings found in *${areaName}*.\n\n` +
      `Send *Hi* to return to the menu.`
    );
    return;
  }

  // Build results message — one block per listing
  const typeLabel = draft.type === CONST_KEY.PROPERTY_TYPE.RENT ? 'RENT' : 'SALE';
  const header    = `🏠 *${listings.length} listing(s) found!*\n` +
                    `Type: *${typeLabel}* · Area: *${areaName}*\n` +
                    `${'─'.repeat(28)}\n\n`;

  const body = listings.map((p, i) =>
    `*${i + 1}. ${p.title}*\n` +
    `💰 Price:   ₹${p.price.toLocaleString('en-IN')}` +
    `${draft.type === CONST_KEY.PROPERTY_TYPE.RENT ? '/mo' : ''}\n` +
    `📞 Contact: ${p.sellerContact}\n`
  ).join('\n');

  const footer = `\nSend *Hi* to return to the menu.`;

  await sendText(from, header + body + footer);
}

module.exports = {
  startSearchFlow,
  handleSearchType,
  handleSearchArea,
  handleSearchAreaPage,
};