// Presentation-only controller: independent of market feeds, alerts, and replay.
export const TERMINAL_STORAGE_KEY = 'btcLiveTerminalV1';
export const DENSITIES = Object.freeze(['compact', 'comfortable', 'analysis']);
export const LAYOUTS = Object.freeze(['standard', 'wide', 'stacked']);
export const DEFAULT_TERMINAL = Object.freeze({ density: 'comfortable', layout: 'standard' });
export function sanitizeTerminal(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { density: DENSITIES.includes(v.density) ? v.density : DEFAULT_TERMINAL.density,
    layout: LAYOUTS.includes(v.layout) ? v.layout : DEFAULT_TERMINAL.layout };
}
export function matchCommands(commands, query) {
  const q = String(query ?? '').trim().toLowerCase();
  return commands.filter(command => !q || (command.title + ' ' + (command.hint ?? '')).toLowerCase().includes(q));
}
export function createTerminalExperience({ root = document, storage = (globalThis.browser ?? globalThis.chrome)?.storage?.local,
  navigate = () => false, onFocus = () => {} } = {}) {
  const shell = root.getElementById('dashboardShell');
  const density = root.getElementById('terminalDensity');
  const layout = root.getElementById('terminalLayout');
  const focus = root.getElementById('terminalFocus');
  const trigger = root.getElementById('terminalCommand');
  const dialog = root.getElementById('terminalPalette');
  const input = root.getElementById('terminalCommandQuery');
  const list = root.getElementById('terminalCommandList');
  let value = { ...DEFAULT_TERMINAL }, focused = false, selected = 0, changed = false, disposed = false;
  function apply(next, user = false) {
    if (user) changed = true;
    value = sanitizeTerminal(next);
    shell.dataset.density = value.density;
    shell.dataset.layout = value.layout;
    density.value = value.density;
    layout.value = value.layout;
    if (user) Promise.resolve(storage?.set({ [TERMINAL_STORAGE_KEY]: value })).catch(error => console.warn('Terminal preferences save failed', error));
  }
  function setFocus(next) {
    focused = Boolean(next);
    shell.dataset.terminalFocus = String(focused);
    focus.setAttribute('aria-pressed', String(focused));
    focus.textContent = focused ? 'Exit chart focus' : 'Chart focus';
    if (focused) navigate('live');
    onFocus(focused);
  }
  const views = ['live','analytics','replay','alerts','diagnostics','settings'];
  const commands = [
    ...views.map(view => ({title:'Open ' + view[0].toUpperCase() + view.slice(1),hint:'Workspace',run:()=>{setFocus(false);navigate(view);}})),
    ...DENSITIES.map(mode => ({title:'Density: '+mode,hint:'Appearance',run:()=>apply({...value,density:mode},true)})),
    ...LAYOUTS.map(mode => ({title:'Layout: '+mode,hint:'Appearance',run:()=>apply({...value,layout:mode},true)})),
    {title:'Toggle chart focus',hint:'Live chart',run:()=>setFocus(!focused)}
  ];
  let matches = commands;
  function paint() {
    matches = matchCommands(commands, input.value);
    selected = Math.max(0, Math.min(selected, matches.length-1));
    list.replaceChildren();
    matches.forEach((command,index) => {
      const button = root.createElement('button'); button.type='button';button.className='terminal-command-item';
      button.setAttribute('role','option');button.setAttribute('aria-selected',String(index===selected));
      const name = root.createElement('span');name.textContent=command.title;
      const hint=root.createElement('small');hint.textContent=command.hint;
      button.append(name,hint);button.addEventListener('click',()=>execute(index));list.append(button);
    });
    if (!matches.length) { const empty=root.createElement('p'); empty.textContent='No commands found'; empty.className='terminal-command-help';list.append(empty); }
  }
  function execute(index) { const cmd = matches[index]; if(!cmd)return; dialog.close();cmd.run(); }
  function open() { if (typeof dialog.showModal !== 'function') return; input.value='';selected=0;paint();if(!dialog.open)dialog.showModal();input.focus(); }
  function onKey(event) {
    const target=event.target;
    const editable=target?.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='k') { event.preventDefault();open();return; }
    if (!editable && !dialog.open && !event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase()==='f') {event.preventDefault();setFocus(!focused);}
  }
  function onInputKey(event) {
    if(event.key==='ArrowDown' || event.key==='ArrowUp') {event.preventDefault();selected=(selected+(event.key==='ArrowDown'?1:-1)+matches.length)%Math.max(1,matches.length);paint();}
    if(event.key==='Enter'){event.preventDefault();execute(selected);}
  }
  const onDensity=()=>apply({...value,density:density.value},true);
  const onLayout=()=>apply({...value,layout:layout.value},true);
  const onFocusClick=()=>setFocus(!focused);
  density.addEventListener('change',onDensity); layout.addEventListener('change',onLayout);
  focus.addEventListener('click',onFocusClick);trigger.addEventListener('click',open);
  input.addEventListener('input',paint);input.addEventListener('keydown',onInputKey);
  root.addEventListener('keydown',onKey);
  apply(value);
  Promise.resolve(storage?.get(TERMINAL_STORAGE_KEY)).then(data=>{if(!disposed && !changed)apply(data?.[TERMINAL_STORAGE_KEY]);}).catch(error=>console.warn('Terminal preferences load failed',error));
  return { preferences:()=>({...value}), focus:()=>focused, setFocus, dispose() { disposed=true;root.removeEventListener('keydown',onKey);density.removeEventListener('change',onDensity);layout.removeEventListener('change',onLayout);focus.removeEventListener('click',onFocusClick);trigger.removeEventListener('click',open);input.removeEventListener('input',paint);input.removeEventListener('keydown',onInputKey);if(dialog.open)dialog.close(); } };
}
