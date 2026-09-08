import {getOriginPattern, getSettings, isUrlWithinConfiguredBase, normalizeArgoUrl, setSettings} from './settings.js';

const urlInput = document.getElementById('argocd-url');
const saveButton = document.getElementById('save');
const enabledToggle = document.getElementById('enabled');
const status = document.getElementById('site-status');
const message = document.getElementById('message');

let currentSettings = {configuredUrl: '', enabled: true};
let activeTab = null;

function setMessage(text, kind = '') {
  message.textContent = text;
  message.className = `message ${kind}`.trim();
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({active: true, currentWindow: true});
  return tabs[0] || null;
}

function updateStatus() {
  const configured = Boolean(currentSettings.configuredUrl);
  enabledToggle.disabled = !configured;
  enabledToggle.checked = configured && currentSettings.enabled;

  if (!configured) {
    status.textContent = 'Not configured';
    status.className = 'status';
    return;
  }

  if (activeTab?.url && isUrlWithinConfiguredBase(activeTab.url, currentSettings.configuredUrl)) {
    status.textContent = currentSettings.enabled ? 'Active here' : 'Original UI';
    status.className = currentSettings.enabled ? 'status active' : 'status inactive';
    return;
  }

  status.textContent = 'Different site';
  status.className = 'status inactive';
}

async function syncRegistration() {
  const response = await chrome.runtime.sendMessage({type: 'sync-registration'});
  if (!response?.ok) {
    throw new Error(response?.error || 'Unable to update the site registration.');
  }
}

async function injectIntoActiveTabIfEligible() {
  if (!activeTab?.id || !activeTab.url || !isUrlWithinConfiguredBase(activeTab.url, currentSettings.configuredUrl)) {
    return;
  }

  try {
    await chrome.scripting.insertCSS({target: {tabId: activeTab.id}, files: ['modern.css']});
    await chrome.scripting.executeScript({target: {tabId: activeTab.id}, files: ['content.js']});
  } catch (error) {
    // Some restricted browser pages cannot be scripted. The configured Argo CD page
    // will still receive the script on its next navigation through registration.
    console.debug('[Argo CD Modern UI] Immediate injection skipped.', error);
  }
}

saveButton.addEventListener('click', async () => {
  setMessage('');
  saveButton.disabled = true;

  try {
    const normalized = normalizeArgoUrl(urlInput.value);
    const newPattern = getOriginPattern(normalized);
    const oldPattern = currentSettings.configuredUrl ? getOriginPattern(currentSettings.configuredUrl) : null;

    const granted = await chrome.permissions.request({origins: [newPattern]});
    if (!granted) {
      throw new Error('Site access was not granted. The extension cannot run on this Argo CD instance.');
    }

    await setSettings({configuredUrl: normalized});
    currentSettings = {...currentSettings, configuredUrl: normalized};
    urlInput.value = normalized;
    await syncRegistration();

    if (oldPattern && oldPattern !== newPattern) {
      await chrome.permissions.remove({origins: [oldPattern]});
    }

    await injectIntoActiveTabIfEligible();
    updateStatus();
    setMessage('Saved. Modern UI is limited to this Argo CD URL.', 'success');
  } catch (error) {
    setMessage(String(error?.message || error), 'error');
  } finally {
    saveButton.disabled = false;
  }
});

enabledToggle.addEventListener('change', async () => {
  if (!currentSettings.configuredUrl) {
    enabledToggle.checked = false;
    return;
  }

  const enabled = enabledToggle.checked;
  await setSettings({enabled});
  currentSettings = {...currentSettings, enabled};
  await injectIntoActiveTabIfEligible();
  updateStatus();
  setMessage(enabled ? 'Modern UI enabled.' : 'Original Argo CD UI restored.', 'success');
});

async function init() {
  [currentSettings, activeTab] = await Promise.all([getSettings(), getActiveTab()]);
  urlInput.value = currentSettings.configuredUrl;
  updateStatus();
}

void init();
