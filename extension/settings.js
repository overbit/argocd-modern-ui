export const UI_MODES = Object.freeze(['original', 'hybrid', 'full']);
export const THEMES = Object.freeze(['system', 'light', 'dark']);

export const DEFAULT_SETTINGS = Object.freeze({
  configuredUrl: '',
  uiMode: 'hybrid',
  theme: 'system'
});

export function normalizeUiMode(value, legacyEnabled = true) {
  if (UI_MODES.includes(value)) {
    return value;
  }
  return legacyEnabled === false ? 'original' : 'hybrid';
}

export function normalizeTheme(value) {
  return THEMES.includes(value) ? value : 'system';
}

export function normalizeArgoUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw new Error('Enter the URL of your Argo CD instance.');
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Enter a valid absolute URL, for example https://argocd.example.com.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http:// and https:// Argo CD URLs are supported.');
  }

  parsed.username = '';
  parsed.password = '';
  parsed.search = '';
  parsed.hash = '';

  let pathname = parsed.pathname.replace(/\/{2,}/g, '/');
  if (pathname.length > 1) {
    pathname = pathname.replace(/\/+$/, '');
  }

  return `${parsed.origin}${pathname === '/' ? '' : pathname}`;
}

export function getOriginPattern(configuredUrl) {
  const parsed = new URL(normalizeArgoUrl(configuredUrl));
  return `${parsed.origin}/*`;
}

export function isUrlWithinConfiguredBase(candidateUrl, configuredUrl) {
  if (!candidateUrl || !configuredUrl) {
    return false;
  }

  try {
    const candidate = new URL(candidateUrl);
    const configured = new URL(normalizeArgoUrl(configuredUrl));
    if (candidate.origin !== configured.origin) {
      return false;
    }

    const basePath = configured.pathname === '/' ? '' : configured.pathname.replace(/\/+$/, '');
    if (!basePath) {
      return true;
    }

    return candidate.pathname === basePath || candidate.pathname.startsWith(`${basePath}/`);
  } catch {
    return false;
  }
}

export async function getSettings() {
  const stored = await chrome.storage.local.get({...DEFAULT_SETTINGS, enabled: true});
  return {
    configuredUrl: stored.configuredUrl || '',
    uiMode: normalizeUiMode(stored.uiMode, stored.enabled),
    theme: normalizeTheme(stored.theme)
  };
}

export async function setSettings(next) {
  const normalized = {...next};
  if (Object.prototype.hasOwnProperty.call(normalized, 'uiMode')) {
    normalized.uiMode = normalizeUiMode(normalized.uiMode);
    normalized.enabled = normalized.uiMode !== 'original';
  }
  if (Object.prototype.hasOwnProperty.call(normalized, 'theme')) {
    normalized.theme = normalizeTheme(normalized.theme);
  }
  await chrome.storage.local.set(normalized);
}
