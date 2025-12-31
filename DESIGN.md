# Chrome Extension MV3 Snippet Expander for WhatsApp Web - Design

## 1. Detection of WhatsApp Message Composer
WhatsApp Web uses a `div` with `contenteditable="true"` for typing messages.
- **Selector Strategy:** Look for `div[contenteditable="true"]`. To be more specific, we can look for it within the footer or main chat area, often identified by specific classes or ARIA roles (e.g., `role="textbox"`).
- **Mechanism:** Use `MutationObserver` to detect when the chat window opens or changes, and attach event listeners to the input field. Alternatively, use event delegation on the `document` body to catch `input` events and check `event.target`.

## 2. Event Triggers and Replacement Logic
- **Trigger:** Listen for `input` events.
- **Buffer:** Keep track of text being typed. Since the cursor can move, a simple buffer might be insufficient. It's better to look at the text immediately preceding the caret (cursor) position.
- **Detection:**
    1. Get current selection/cursor position.
    2. Read text backwards from cursor to find a potential trigger.
    3. Check against stored snippets.
- **Replacement:**
    - Use `document.execCommand('insertText', false, expansion)` if possible, as it handles the React state updates and Undo history best.
    - If `execCommand` fails or is removed, use `Range` manipulation, but then we must dispatch `input` events manually to ensure WhatsApp's React components notice the change (otherwise the "Send" button might remain disabled).

## 3. Data Model & Storage
- **Storage:** `chrome.storage.local`
- **Schema:**
  ```json
  {
    "snippets": [
      {
        "id": "uuid-v4",
        "trigger": ";test",
        "expansion": "Hello world",
        "enabled": true
      }
    ]
  }
  ```
