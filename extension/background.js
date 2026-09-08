import {getOriginPattern, getSettings} from './settings.js';

const CONTENT_SCRIPT_ID = 'argocd-modern-ui-content';

async function unregisterContentScript() {
  try {
    await chrome.scripting.unregisterContentScripts({ids: [CONTENT_SCRIPT_ID]});
  } catch (error) {
    // Chrome throws when the registration does not exist. That is already the desired state.
    if (!String(error?.message || error).toLowerCase().includes('nonexistent')) {
      console.warn('[Argo CD Modern UI] Unable to remove old content script registration.', error);
    }
  }
}

export async function syncRegistration() {
  await unregisterContentScript();

  const {configuredUrl} = await getSettings();
  if (!configuredUrl) {
    return;
  }

  const pattern = getOriginPattern(configuredUrl);
  const allowed = await chrome.permissions.contains({origins: [pattern]});
  if (!allowed) {
    return;
  }

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      matches: [pattern],
      js: ['full-ui.js', 'content.js'],
      css: ['modern.css', 'github-theme.css'],
      runAt: 'document_idle',
      persistAcrossSessions: true
    }
  ]);
}

chrome.runtime.onInstalled.addListener(() => {
  void syncRegistration();
});

chrome.runtime.onStartup.addListener(() => {
  void syncRegistration();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && Object.prototype.hasOwnProperty.call(changes, 'configuredUrl')) {
    void syncRegistration();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'sync-registration') {
    return false;
  }

  syncRegistration()
    .then(() => sendResponse({ok: true}))
    .catch(error => sendResponse({ok: false, error: String(error?.message || error)}));
  return true;
});
