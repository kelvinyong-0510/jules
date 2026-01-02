let snippets = [];
let debugLog = false;

// Fetch snippets and settings on load
chrome.storage.sync.get(null, (items) => {
    // Process snippets
    const newSnippets = [];
    for (const key in items) {
        if (key.startsWith('snippet_')) {
            newSnippets.push(items[key]);
        }
    }
    // Sort snippets by length descending to prioritize longer triggers
    snippets = newSnippets.sort((a, b) => b.trigger.length - a.trigger.length);

    // Process settings
    if (items.debugLog) {
        debugLog = !!items.debugLog;
    }

    log('Loaded snippets:', snippets.length);
    log('Debug logging enabled:', debugLog);
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        // Check for debug log change
        if (changes.debugLog) {
            debugLog = !!changes.debugLog.newValue;
            log('Debug logging updated:', debugLog);
        }

        // Efficiently update snippets
        let needsSort = false;
        for (const key in changes) {
            if (key.startsWith('snippet_')) {
                const change = changes[key];
                if (change.newValue) {
                    // Add or Update
                    const index = snippets.findIndex(s => s.id === change.newValue.id);
                    if (index !== -1) {
                        snippets[index] = change.newValue;
                    } else {
                        snippets.push(change.newValue);
                    }
                } else {
                    // Deleted
                    const id = key.replace('snippet_', '');
                    snippets = snippets.filter(s => s.id !== id);
                }
                needsSort = true;
                log('Snippet update detected for:', key);
            }
        }

        if (needsSort) {
            snippets.sort((a, b) => b.trigger.length - a.trigger.length);
        }
    }
});

function log(...args) {
    if (debugLog) {
        console.log('[WA Expander]', ...args);
    }
}

// React 15/16+ Value Setter hack
function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;

    if (valueSetter && valueSetter !== prototypeValueSetter) {
        prototypeValueSetter.call(element, value);
    } else {
        valueSetter.call(element, value);
    }
}

// Use Capture Phase to catch event, but check DOM on next tick
document.addEventListener('input', function(e) {
    const target = e.target;

    // Basic validity check
    if (!target || !document.body.contains(target)) return;

    // We use setTimeout to allow the browser to update the DOM/Selection
    // fully before we read it. This fixes the "off-by-one" char lag
    // common in React apps (like WhatsApp) where state updates are async.
    setTimeout(() => {
        checkAndExpand(target);
    }, 0);

}, true);

function checkAndExpand(target) {
    // Re-verify target existence and focus
    if (!document.body.contains(target)) return;

    // Ensure we are operating on the active element to avoid ghost writes
    // (Exception: sometimes activeElement is body if focus is lost momentarily,
    // but usually for typing it matches)
    // if (document.activeElement !== target && target.tagName !== 'BODY') return;

    // Determine the context and text
    let text = '';
    let cursorPosition = 0;
    let isInput = false;

    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        isInput = true;
        text = target.value;
        cursorPosition = target.selectionEnd;

        if (target.type === 'password') return;

    } else if (target.isContentEditable) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        // WhatsApp/RichText: Cursor must be in a text node
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

        if (!trigger) continue;

        const startCheck = cursorPosition - trigger.length;

        if (startCheck >= 0) {
            const potentialMatch = text.substring(startCheck, cursorPosition);

            if (potentialMatch === trigger) {
                log('Match found:', trigger);

                if (isInput) {
                    // For Input/Textarea
                    const before = text.substring(0, startCheck);
                    const after = text.substring(cursorPosition);
                    const newValue = before + replacement + after;
                    const newCursorPos = startCheck + replacement.length;

                    target.selectionStart = startCheck;
                    target.selectionEnd = cursorPosition;

                    // Try standard execCommand
                    let success = false;
                    try {
                        success = document.execCommand('insertText', false, replacement);
                    } catch (e) {
                        log('execCommand error:', e);
                    }

                    if (!success) {
                        log('execCommand failed/unsupported, using value setter hack');
                        try {
                            setNativeValue(target, newValue);
                        } catch (err) {
                            target.value = newValue;
                        }

                        target.selectionStart = target.selectionEnd = newCursorPos;
                        target.dispatchEvent(new Event('input', { bubbles: true }));
                        target.dispatchEvent(new Event('change', { bubbles: true }));
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
}
