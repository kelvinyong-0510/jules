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
    const target = e.target;
    if (!document.body.contains(target)) return;

    // Determine the context and text
    let text = '';
    let cursorPosition = 0;
    let isInput = false;

    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        isInput = true;
        text = target.value;
        cursorPosition = target.selectionEnd;
    } else if (target.isContentEditable) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        // We only care if we are inside a text node for contentEditable
        if (node.nodeType !== Node.TEXT_NODE) return;
        text = node.textContent;
        cursorPosition = range.startOffset;
    } else {
        return;
    }

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

                if (isInput) {
                    // For Input/Textarea
                    target.selectionStart = startCheck;
                    target.selectionEnd = cursorPosition;

                    const success = document.execCommand('insertText', false, replacement);
                    log('Input replacement success:', success);

                    // Fallback if execCommand fails (though it shouldn't on standard inputs)
                    if (!success) {
                       const before = text.substring(0, startCheck);
                       const after = text.substring(cursorPosition);
                       target.value = before + replacement + after;
                       const newCursorPos = startCheck + replacement.length;
                       target.selectionStart = target.selectionEnd = newCursorPos;
                       // Dispatch input event to ensure frameworks catch it
                       target.dispatchEvent(new Event('input', { bubbles: true }));
                    }

                } else {
                    // For ContentEditable
                    const selection = window.getSelection();
                    const range = selection.getRangeAt(0);
                    const node = range.startContainer;

                    const newRange = document.createRange();
                    newRange.setStart(node, startCheck);
                    newRange.setEnd(node, cursorPosition);

                    selection.removeAllRanges();
                    selection.addRange(newRange);

                    const success = document.execCommand('insertText', false, replacement);
                    log('ContentEditable replacement success:', success);
                }

                // Stop after first match
                break;
            }
        }
    }
});
