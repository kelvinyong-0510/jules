let snippets = [];
let debugLog = false;

// Fetch snippets and settings on load
chrome.storage.local.get(['snippets', 'debugLog'], (result) => {
    if (result.snippets) {
        snippets = result.snippets;
    }
    debugLog = !!result.debugLog;
    log('Loaded snippets:', snippets.length);
    log('Debug logging enabled:', debugLog);
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.snippets) {
            snippets = changes.snippets.newValue || [];
            log('Snippets updated:', snippets.length);
        }
        if (changes.debugLog) {
            debugLog = !!changes.debugLog.newValue;
            log('Debug logging updated:', debugLog);
        }
    }
});

function log(...args) {
    if (debugLog) {
        console.log('[WA Expander]', ...args);
    }
}

document.addEventListener('input', function(e) {
    // Only fire on contenteditable elements
    if (!e.target.isContentEditable) return;

    // Hardening: Check if it's likely the main chat input
    // WhatsApp usually puts the input in a footer or main region.
    // Also, checking if it is the active element is good practice.
    if (document.activeElement !== e.target) return;

    // Safety check: Ensure we are in a valid context (e.g., inside document body)
    if (!document.body.contains(e.target)) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;

    // We only care if we are inside a text node
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent;
    const cursorPosition = range.startOffset;

    // Check against all enabled snippets
    for (const snippet of snippets) {
        if (!snippet.enabled) continue;

        const trigger = snippet.trigger;
        const replacement = snippet.expansion;

        // Skip empty triggers
        if (!trigger) continue;

        const startCheck = cursorPosition - trigger.length;

        if (startCheck >= 0) {
            const potentialMatch = text.substring(startCheck, cursorPosition);

            if (potentialMatch === trigger) {
                log('Match found:', trigger);

                // Select the trigger text
                const newRange = document.createRange();
                newRange.setStart(node, startCheck);
                newRange.setEnd(node, cursorPosition);

                selection.removeAllRanges();
                selection.addRange(newRange);

                // Replace it using execCommand
                // This is deprecated but widely used for this exact purpose to preserve undo stack
                // and trigger React/framework state updates.
                const success = document.execCommand('insertText', false, replacement);

                log('Replacement success:', success);

                // Stop after first match
                break;
            }
        }
    }
});
