/** Display the installed extension version; do not infer a release from a source checkout. */
export function resolveExtensionVersion(api) {
  try {
    const version = api?.runtime?.getManifest?.()?.version;
    return typeof version === 'string' && /^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version) ? version : null;
  } catch { return null; }
}
export function displayExtensionVersion(root, api) {
  const version = resolveExtensionVersion(api);
  for (const label of root.querySelectorAll('[data-extension-version]')) {
    label.textContent = version ? `BTC LIVE · V${version}` : 'BTC LIVE · Version unavailable';
  }
}
