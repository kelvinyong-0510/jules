document.addEventListener('DOMContentLoaded', () => {
  const triggerInput = document.getElementById('trigger');
  const expansionInput = document.getElementById('expansion');
  const addBtn = document.getElementById('add-btn');
  const listDiv = document.getElementById('snippet-list');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');
  const debugLogCheckbox = document.getElementById('debug-log');
  const viewDataBtn = document.getElementById('view-data-btn');

  let editingId = null;

  // Load snippets on start
  loadSnippets();
  loadSettings();

  addBtn.addEventListener('click', () => {
    const trigger = triggerInput.value.trim();
    const expansion = expansionInput.value;

    if (!trigger || !expansion) return;

    const id = editingId || crypto.randomUUID();
    const snippetKey = 'snippet_' + id;

    const snippet = {
      id,
      trigger,
      expansion,
      enabled: true
    };

    // Preserve enabled state if editing
    if (editingId) {
        chrome.storage.sync.get([snippetKey], (result) => {
            if (result[snippetKey]) {
                snippet.enabled = result[snippetKey].enabled;
            }
            save(snippetKey, snippet);
        });
    } else {
        save(snippetKey, snippet);
    }
  });

  function save(key, data) {
    const update = {};
    update[key] = data;
    chrome.storage.sync.set(update, () => {
        resetForm();
        loadSnippets();
    });
  }

  function resetForm() {
    triggerInput.value = '';
    expansionInput.value = '';
    editingId = null;
    addBtn.textContent = 'Add Snippet';
    addBtn.style.background = '#28a745';
  }

  function loadSnippets() {
    chrome.storage.sync.get(null, (items) => {
      const snippets = [];
      for (const key in items) {
        if (key.startsWith('snippet_')) {
            snippets.push(items[key]);
        }
      }
      renderList(snippets);
    });
  }

  function loadSettings() {
    chrome.storage.sync.get(['debugLog'], (result) => {
      debugLogCheckbox.checked = !!result.debugLog;
    });
  }

  debugLogCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ debugLog: debugLogCheckbox.checked });
  });

  viewDataBtn.addEventListener('click', () => {
    chrome.storage.sync.get(null, (items) => {
        const json = JSON.stringify(items, null, 2);
        const win = window.open('', 'Storage Data', 'width=600,height=400');
        if (win) {
            win.document.write('<pre>' + escapeHtml(json) + '</pre>');
            win.document.close();
        } else {
            alert('Popup blocked. Check console for data.');
            console.log('Storage Data:', items);
        }
    });
  });

  function renderList(snippets) {
    listDiv.innerHTML = '';
    // Sort by trigger for easier finding
    snippets.sort((a, b) => a.trigger.localeCompare(b.trigger));

    snippets.forEach(s => {
      const item = document.createElement('div');
      item.className = 'snippet-item' + (s.enabled ? '' : ' disabled');

      const info = document.createElement('div');
      info.className = 'snippet-info';
      info.innerHTML = `<div class="snippet-trigger">${escapeHtml(s.trigger)}</div><div class="snippet-expansion">${escapeHtml(s.expansion)}</div>`;

      const controls = document.createElement('div');
      controls.className = 'controls';

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.style.marginRight = '2px';
      editBtn.onclick = () => startEdit(s);

      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = s.enabled ? 'On' : 'Off';
      toggleBtn.onclick = () => toggleSnippet(s);

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Del';
      delBtn.onclick = () => deleteSnippet(s.id);

      controls.appendChild(editBtn);
      controls.appendChild(toggleBtn);
      controls.appendChild(delBtn);

      item.appendChild(info);
      item.appendChild(controls);
      listDiv.appendChild(item);
    });
  }

  function startEdit(snippet) {
      editingId = snippet.id;
      triggerInput.value = snippet.trigger;
      expansionInput.value = snippet.expansion;
      addBtn.textContent = 'Update Snippet';
      addBtn.style.background = '#007bff';
      window.scrollTo(0, 0);
  }

  function toggleSnippet(snippet) {
    snippet.enabled = !snippet.enabled;
    const key = 'snippet_' + snippet.id;
    const update = {};
    update[key] = snippet;
    chrome.storage.sync.set(update, loadSnippets);
  }

  function deleteSnippet(id) {
    if (!confirm('Are you sure?')) return;
    const key = 'snippet_' + id;
    chrome.storage.sync.remove(key, () => {
        if (editingId === id) resetForm();
        loadSnippets();
    });
  }

  // Export
  exportBtn.addEventListener('click', () => {
    chrome.storage.sync.get(null, (items) => {
      const snippets = [];
      for (const key in items) {
        if (key.startsWith('snippet_')) {
            snippets.push(items[key]);
        }
      }
      const blob = new Blob([JSON.stringify(snippets, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'snippets.json';
      a.click();
    });
  });

  // Import
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
             const updates = {};
             imported.forEach(s => {
                 const id = s.id || crypto.randomUUID();
                 const key = 'snippet_' + id;
                 updates[key] = { ...s, id };
             });

             chrome.storage.sync.set(updates, () => {
               alert('Imported successfully!');
               loadSnippets();
             });
        } else {
          alert('Invalid JSON format');
        }
      } catch (err) {
        alert('Error parsing JSON');
      }
    };
    reader.readAsText(file);
  });

  function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
  }
});
