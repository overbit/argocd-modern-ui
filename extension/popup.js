import {getOriginPattern, getSettings, isUrlWithinConfiguredBase, normalizeArgoUrl, setSettings} from './settings.js';

const urlInput = document.getElementById('argocd-url');
const saveButton = document.getElementById('save');
const status = document.getElementById('site-status');
const message = document.getElementById('message');
const modeInputs = [...document.querySelectorAll('input[name="ui-mode"]')];
const themeInputs = [...document.querySelectorAll('input[name="theme"]')];

let currentSettings = {configuredUrl: '', uiMode: 'hybrid', theme: 'system'};
let activeTab = null;

function setMessage(text, kind = '') {
  message.textContent = text;
  message.className = `message ${kind}`.trim();
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({active: true, currentWindow: true});
  return tabs[0] || null;
}

function selectedLabel(value) {
  return value === 'full' ? 'Full UI' : value === 'hybrid' ? 'Hybrid UI' : 'Original UI';
}

function updateStatus() {
  const configured = Boolean(currentSettings.configuredUrl);
  [...modeInputs, ...themeInputs].forEach(input => { input.disabled = !configured; });
  modeInputs.forEach(input => { input.checked = input.value === currentSettings.uiMode; });
  themeInputs.forEach(input => { input.checked = input.value === currentSettings.theme; });

  if (!configured) {
    status.textContent = 'Not configured';
    status.className = 'status';
    return;
  }

  if (activeTab?.url && isUrlWithinConfiguredBase(activeTab.url, currentSettings.configuredUrl)) {
    status.textContent = selectedLabel(currentSettings.uiMode);
    status.className = currentSettings.uiMode === 'original' ? 'status inactive' : 'status active';
    return;
  }

  status.textContent = 'Different site';
  status.className = 'status inactive';
}

async function syncRegistration() {
  const response = await chrome.runtime.sendMessage({type: 'sync-registration'});
  if (!response?.ok) throw new Error(response?.error || 'Unable to update the site registration.');
}

async function injectIntoActiveTabIfEligible() {
  if (!activeTab?.id || !activeTab.url || !isUrlWithinConfiguredBase(activeTab.url, currentSettings.configuredUrl)) return;

  try {
    await chrome.scripting.insertCSS({target: {tabId: activeTab.id}, files: ['modern.css', 'github-theme.css', 'graph.css']});
    await chrome.scripting.executeScript({
      target: {tabId: activeTab.id},
      files: [
        'full-graph-styles.js',
        'full-graph.js',
        'full-graph-base.js',
        'full-direct.js',
        'full-direct-patch.js',
        'full-graph-direct-adapter.js',
        'full-controls.js',
        'full-changeflow.js',
        'full-ui.js',
        'full-route.js',
        'content.js'
      ]
    });
  } catch (error) {
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
    if (!granted) throw new Error('Site access was not granted. The extension cannot run on this Argo CD instance.');
    await setSettings({configuredUrl: normalized});
    currentSettings = {...currentSettings, configuredUrl: normalized};
    urlInput.value = normalized;
    await syncRegistration();
    if (oldPattern && oldPattern !== newPattern) await chrome.permissions.remove({origins: [oldPattern]});
    await injectIntoActiveTabIfEligible();
    updateStatus();
    setMessage('Saved. Access is limited to this Argo CD URL.', 'success');
  } catch (error) {
    setMessage(String(error?.message || error), 'error');
  } finally {
    saveButton.disabled = false;
  }
});

modeInputs.forEach(input => input.addEventListener('change', async () => {
  if (!input.checked || !currentSettings.configuredUrl) return;
  await setSettings({uiMode: input.value});
  currentSettings = {...currentSettings, uiMode: input.value};
  await injectIntoActiveTabIfEligible();
  updateStatus();
  setMessage(`${selectedLabel(input.value)} selected.`, 'success');
}));

themeInputs.forEach(input => input.addEventListener('change', async () => {
  if (!input.checked || !currentSettings.configuredUrl) return;
  await setSettings({theme: input.value});
  currentSettings = {...currentSettings, theme: input.value};
  await injectIntoActiveTabIfEligible();
  updateStatus();
  setMessage(`${input.value[0].toUpperCase()}${input.value.slice(1)} theme selected.`, 'success');
}));

async function init() {
  [currentSettings, activeTab] = await Promise.all([getSettings(), getActiveTab()]);
  urlInput.value = currentSettings.configuredUrl;
  updateStatus();
}

void init();