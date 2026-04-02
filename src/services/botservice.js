const userDao                  = require('../dao/userDao');
const { sendText, sendButtons} = require('../utils/whatsapp');

const { handleAskName,
        handleAskContact }     = require('./onboardingService');

const { startListFlow,
        handleListType,
        handleListTitle,
        handleListArea,
        handleListAreaPage,
        handleListPrice,
        handleConfirmListing,
        startMyListingsFlow,
        handleMyListings,
        handleListingAction,
        handleEditTitle,       // ← updated
        handleEditPrice,       // ← new
        handleConfirmEdit,
        handleDeleteConfirm }  = require('./listingService');

const { startSearchFlow,
        handleSearchType,       
        handleSearchArea,       // ← new
        handleSearchAreaPage,   // ← new
        handleSearchDetails }   = require('./searchService');

// ─── MAIN ROUTER ──────────────────────────────────────────────────────────────

async function handleBotFlow(from, waName, type, text, buttonId, message) {
  const lower = (text || '').toLowerCase().trim();
  const user  = await userDao.findOrCreate(from);

  // ── Onboarding ──────────────────────────────────────────────────────────────
  if (user.step === 'ask_name')       return handleAskName(from, lower, text);
  if (user.step === 'ask_contact')    return handleAskContact(from, text);

  // ── List flow ───────────────────────────────────────────────────────────────
  if (user.step === 'list_type')       return handleListType(from, lower, buttonId);
  if (user.step === 'list_title')      return handleListTitle(from, text);
  if (user.step === 'list_area')       return handleListArea(from, lower, buttonId);
  if (user.step === 'list_area_page')  return handleListAreaPage(from, lower, buttonId);
  if (user.step === 'list_price')      return handleListPrice(from, text);
  if (user.step === 'confirm_listing') return handleConfirmListing(from, buttonId);

  // ── My listings + edit/delete flow ──────────────────────────────────────────
  if (user.step === 'my_listings')    return handleMyListings(from, buttonId);
  if (user.step === 'listing_action') return handleListingAction(from, buttonId);
  if (user.step === 'edit_title')     return handleEditTitle(from, text, buttonId);  // ← updated
  if (user.step === 'edit_price')     return handleEditPrice(from, text, buttonId);  // ← new
  if (user.step === 'confirm_edit')   return handleConfirmEdit(from, buttonId);
  if (user.step === 'delete_confirm') return handleDeleteConfirm(from, buttonId);

  // ── Search flow ─────────────────────────────────────────────────────────────
  if (user.step === 'search_type')      return handleSearchType(from, buttonId);
  if (user.step === 'search_area')      return handleSearchArea(from, buttonId);
  if (user.step === 'search_area_page') return handleSearchAreaPage(from, buttonId);
  // ── Default: main menu ──────────────────────────────────────────────────────
  return handleMainMenu(from, user, lower, buttonId);
}

// ─── MAIN MENU ────────────────────────────────────────────────────────────────

async function handleMainMenu(from, user, lower, buttonId) {
  const isHi         = lower === 'hi' || lower === 'hello' || lower === 'start';
  const isList       = buttonId === 'list'        || lower === 'list'        || lower === 'list property';
  const isSearch     = buttonId === 'search'      || lower === 'search'      || lower === 'buy' || lower === 'rent';
  const isMyListings = buttonId === 'my_listings' || lower === 'my listings' || lower === 'my listing';

  if (isHi)         { await sendMenu(from, user.name);    return; }
  if (isList)       { await startListFlow(from);          return; }
  if (isSearch)     { await startSearchFlow(from);        return; }
  if (isMyListings) { await startMyListingsFlow(from);    return; }

  await sendText(from, 'Send *Hi* to see the menu.');
}

async function sendMenu(to, name) {
  await sendButtons(
    to,
    `Hi *${name || 'there'}*! 👋 Welcome to PropertyBot.\n\nWhat would you like to do?`,
    [
      { id: 'list',        title: '🏠 List property'   },
      { id: 'search',      title: '🔍 Search property' },
      { id: 'my_listings', title: '📋 My Listings'     },
    ]
  );
}

module.exports = { handleBotFlow };