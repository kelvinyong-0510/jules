document.addEventListener('DOMContentLoaded', () => {
  const triggerInput = document.getElementById('trigger');
  const expansionInput = document.getElementById('expansion');
  const addBtn = document.getElementById('add-btn');
  const listDiv = document.getElementById('snippet-list');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');
  const debugLogCheckbox = document.getElementById('debug-log');

  // Load snippets on start
  loadSnippets();
  loadSettings();

  addBtn.addEventListener('click', () => {
    const trigger = triggerInput.value.trim();
    const expansion = expansionInput.value;

    if (!trigger || !expansion) return;

    const snippet = {
      id: crypto.randomUUID(),
      trigger,
      expansion,
      enabled: true
    };

    chrome.storage.local.get(['snippets'], (result) => {
      const snippets = result.snippets || [];
      snippets.push(snippet);
      chrome.storage.local.set({ snippets }, () => {
        triggerInput.value = '';
        expansionInput.value = '';
        loadSnippets();
      });
    });
  });

  function loadSnippets() {
    chrome.storage.local.get(['snippets'], (result) => {
      const snippets = result.snippets || [];
      renderList(snippets);
    });
  }

  function loadSettings() {
    chrome.storage.local.get(['debugLog'], (result) => {
      debugLogCheckbox.checked = !!result.debugLog;
    });
  }

  debugLogCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ debugLog: debugLogCheckbox.checked });
  });

  function renderList(snippets) {
    listDiv.innerHTML = '';
    snippets.forEach(s => {
      const item = document.createElement('div');
      item.className = 'snippet-item' + (s.enabled ? '' : ' disabled');

      const info = document.createElement('div');
      info.className = 'snippet-info';
      info.innerHTML = `<div class="snippet-trigger">${escapeHtml(s.trigger)}</div><div class="snippet-expansion">${escapeHtml(s.expansion)}</div>`;

      const controls = document.createElement('div');
      controls.className = 'controls';

      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = s.enabled ? 'On' : 'Off';
      toggleBtn.onclick = () => toggleSnippet(s.id);

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Del';
      delBtn.onclick = () => deleteSnippet(s.id);

      controls.appendChild(toggleBtn);
      controls.appendChild(delBtn);

      item.appendChild(info);
      item.appendChild(controls);
      listDiv.appendChild(item);
    });
  }

  function toggleSnippet(id) {
    chrome.storage.local.get(['snippets'], (result) => {
      const snippets = result.snippets || [];
      const index = snippets.findIndex(s => s.id === id);
      if (index !== -1) {
        snippets[index].enabled = !snippets[index].enabled;
        chrome.storage.local.set({ snippets }, loadSnippets);
      }
    });
  }

  function deleteSnippet(id) {
    if (!confirm('Are you sure?')) return;
    chrome.storage.local.get(['snippets'], (result) => {
      const snippets = result.snippets || [];
      const newSnippets = snippets.filter(s => s.id !== id);
      chrome.storage.local.set({ snippets: newSnippets }, loadSnippets);
    });
  }

  // Export
  exportBtn.addEventListener('click', () => {
    chrome.storage.local.get(['snippets'], (result) => {
      const snippets = result.snippets || [];
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
          chrome.storage.local.get(['snippets'], (result) => {
             // Merge strategy: Append. Could be improved to check dupes.
             const current = result.snippets || [];
             // Assign IDs if missing
             const final = [...current, ...imported.map(s => ({ ...s, id: s.id || crypto.randomUUID() }))];
             chrome.storage.local.set({ snippets: final }, () => {
               alert('Imported successfully!');
               loadSnippets();
             });
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
