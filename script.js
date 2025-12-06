/* Mini Tool Dashboard Script */
// Storage keys
const STATE_KEY = 'mini_tool_dashboard_v1';
const THEME_KEY = 'mini_tool_dashboard_theme';

// Elements
const app = document.getElementById('app');
const editor = document.getElementById('editor');
const copyBtn = document.getElementById('copyBtn');
const pasteBtn = document.getElementById('pasteBtn');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');
const historyList = document.getElementById('historyList');
const statusText = document.getElementById('statusText');
const statusRight = document.getElementById('statusRight');
const themeBtn = document.getElementById('themeBtn');
const wc = document.getElementById('wc');
const smallCount = document.getElementById('smallCount');

let state = { snippets: [] }; // { snippets: [{id, text, created}] }

// Utilities
function nowISO(){ return new Date().toISOString(); }
function shortTime(){ return new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }
function saveState(){ localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
function loadState(){
    try {
    const raw = localStorage.getItem(STATE_KEY);
    if(raw) state = JSON.parse(raw);
    } catch (e) {
    console.error('Failed to load state', e);
    state = { snippets: [] };
    }
}

// Render history list
function renderHistory(){
    historyList.innerHTML = '';
    if(!state.snippets.length){
    historyList.innerHTML = `<div style="color:var(--muted)">No snippets yet — save something from the editor.</div>`;
    return;
    }
    state.snippets.forEach((s, idx) => {
    const sn = document.createElement('div');
    sn.className = 'snippet';
    const t = document.createElement('div');
    t.className = 'text';
    t.textContent = s.text;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const time = document.createElement('div');
    time.style.color = 'var(--muted)';
    time.style.fontSize = '12px';
    time.textContent = new Date(s.created).toLocaleString();
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.title = 'Load this snippet into editor';
    loadBtn.addEventListener('click', ()=> {
        editor.value = s.text;
        editor.focus();
        updateCounts();
        showStatus('Loaded snippet', 'left');
    });
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.style.color = 'var(--danger)';
    delBtn.addEventListener('click', ()=> {
        if(!confirm('Delete this snippet?')) return;
        state.snippets.splice(idx,1);
        saveState(); renderHistory();
        showStatus('Snippet deleted', 'left');
    });

    meta.appendChild(time);
    meta.appendChild(loadBtn);
    meta.appendChild(delBtn);

    sn.appendChild(t);
    sn.appendChild(meta);
    historyList.appendChild(sn);
    });
}

// Show status
let statusTimer = null;
function showStatus(text, side='left'){
    statusText.textContent = text;
    statusRight.textContent = `${shortTime()}`;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(()=> {
    statusText.textContent = 'Ready';
    }, 2500);
}

// Counts
function updateCounts(){
    const text = editor.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wc.textContent = `${chars} chars • ${words} words`;
    smallCount.textContent = `${chars} chars • ${words} words`;
}

// Editor autosize
function autoSize(){
    editor.style.height = 'auto';
    editor.style.height = (editor.scrollHeight) + 'px';
}

/* ---------- Actions ---------- */
async function copyEditor(){
    try {
    await navigator.clipboard.writeText(editor.value);
    showStatus('Copied to clipboard');
    } catch (e) {
    // fallback: try select + execCommand
    try {
        editor.select();
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
        showStatus('Copied (fallback)');
    } catch (ee) {
        showStatus('Copy failed', 'left');
        console.error('Copy failed', e, ee);
    }
    }
}

async function pasteToEditor(){
    try {
    const t = await navigator.clipboard.readText();
    // Insert where caret is, if possible
    const start = editor.selectionStart || 0;
    const end = editor.selectionEnd || start;
    const before = editor.value.slice(0, start);
    const after = editor.value.slice(end);
    editor.value = before + t + after;
    editor.selectionStart = editor.selectionEnd = start + t.length;
    updateCounts(); autoSize();
    showStatus('Pasted from clipboard');
    } catch (e) {
    showStatus('Paste blocked — use Ctrl+V', 'left');
    console.error('Paste failed', e);
    }
}

function clearEditor(){
    if(!editor.value) { showStatus('Editor already empty'); return; }
    if(!confirm('Clear editor content?')) return;
    editor.value = '';
    updateCounts(); autoSize();
    showStatus('Cleared');
}

function saveSnippet(){
    const txt = editor.value.trim();
    if(!txt) { showStatus('Nothing to save', 'left'); return; }
    const item = { id: Date.now(), text: txt, created: nowISO() };
    state.snippets.unshift(item);
    // keep max 200 items to be safe
    if(state.snippets.length > 200) state.snippets.length = 200;
    saveState();
    renderHistory();
    showStatus('Snippet saved');
}

// Export JSON
function exportJSON(){
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snippets_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showStatus('Export started');
}

// Import JSON
function importJSONFile(file){
    const reader = new FileReader();
    reader.onload = ()=> {
    try {
        const parsed = JSON.parse(reader.result);
        if(!parsed || !Array.isArray(parsed.snippets)) throw new Error('Invalid file format');
        // Merge: append parsed.snippets (unique by text)
        const existingTexts = new Set(state.snippets.map(s => s.text));
        let added = 0;
        parsed.snippets.forEach(s => {
        if(!existingTexts.has(s.text)) {
            state.snippets.push({ id: s.id || Date.now()+Math.random(), text: s.text, created: s.created || nowISO() });
            added++;
        }
        });
        // sort by created desc
        state.snippets.sort((a,b) => new Date(b.created) - new Date(a.created));
        saveState(); renderHistory();
        showStatus(`Imported ${added} snippets`);
    } catch (e) {
        alert('Failed to import: ' + e.message);
    }
    };
    reader.readAsText(file);
}

/* ---------- Keyboard shortcuts ---------- */
document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const meta = isMac ? e.metaKey : e.ctrlKey;
    // Ctrl/Cmd + Shift + C => Copy
    if(meta && e.shiftKey && e.key.toLowerCase() === 'c'){ e.preventDefault(); copyEditor(); return; }
    // Ctrl/Cmd + Shift + V => Paste
    if(meta && e.shiftKey && e.key.toLowerCase() === 'v'){ e.preventDefault(); pasteToEditor(); return; }
    // Ctrl/Cmd + S => Save snippet (prevent browser save)
    if(meta && !e.shiftKey && e.key.toLowerCase() === 's'){ e.preventDefault(); saveSnippet(); return; }
});

/* ---------- Event bindings ---------- */
copyBtn.addEventListener('click', copyEditor);
pasteBtn.addEventListener('click', pasteToEditor);
clearBtn.addEventListener('click', clearEditor);
saveBtn.addEventListener('click', saveSnippet);
exportBtn.addEventListener('click', exportJSON);
importFile.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if(!f) return;
    importJSONFile(f);
    importFile.value = '';
});

// Editor events
editor.addEventListener('input', ()=> { updateCounts(); autoSize(); });
editor.addEventListener('paste', ()=> { setTimeout(()=>{ updateCounts(); autoSize(); },50); });

// Theme toggle
function setTheme(theme){
    if(theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem(THEME_KEY, theme);
    themeBtn.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
}
themeBtn.addEventListener('click', ()=>{
    const isDark = document.documentElement.classList.toggle('dark');
    setTheme(isDark ? 'dark' : 'light');
});

/* ---------- Init ---------- */
function init(){
    // theme from storage
    const th = localStorage.getItem(THEME_KEY) || 'light';
    setTheme(th);

    // load saved state
    loadState();
    renderHistory();

    updateCounts();
    autoSize();
    showStatus('Ready');
}

// expose small helper to show status from other functions
function exposeShowStatus(){ window._miniToolShowStatus = showStatus; }
exposeShowStatus();

init();
