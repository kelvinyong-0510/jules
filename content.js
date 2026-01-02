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
    snippets = newSnippets;

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
                log('Snippet update detected for:', key);
            }
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

// Use Capture Phase (true) to ensure we catch events before web app stops them
document.addEventListener('input', function(e) {
    const target = e.target;

    // Basic validity check
    if (!target || !document.body.contains(target)) return;

    // Determine the context and text
    let text = '';
    let cursorPosition = 0;
    let isInput = false;

    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        isInput = true;
        text = target.value;
        cursorPosition = target.selectionEnd;

        // Skip password fields
        if (target.type === 'password') return;

    } else if (target.isContentEditable) {
        const selection = window.getSelection();
        if (!selection.rangeCount) {
             return;
        }
        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        if (node.nodeType !== Node.TEXT_NODE) {
            return;
        }

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

                    // Try execCommand first (best for history)
                    target.selectionStart = startCheck;
                    target.selectionEnd = cursorPosition;
                    const success = document.execCommand('insertText', false, replacement);

                    if (!success) {
                        log('execCommand failed, using value setter hack');
                        // Fallback with React support
                        try {
                            setNativeValue(target, newValue);
                        } catch (err) {
                            target.value = newValue;
                        }

                        target.selectionStart = target.selectionEnd = newCursorPos;

                        // Dispatch multiple events to ensure framework detection
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

                break;
            }
        }
    }
}, true); // <--- Capture Phase
