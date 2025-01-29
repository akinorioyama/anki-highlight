# Search Anki card bookmarklet

## Features

1. Fetches decks from AnkiConnect running on localhost:8765.
 
2. Filters cards due within the specified time.
 
3. Displays results dynamically in a textarea.

## How to Use

1. Copy the code.
Create a new bookmark.
 
2. Paste the code into the URL field.

3. Click the bookmark (or use the hotkey from your existing script).

4. Enter the due days and press Fetch Due Cards.

5. If words are found, they will be displayed in a textarea.

```
javascript:(function() {
    async function ankiRequest(action, params = {}) {
        try {
            const response = await fetch("http://localhost:8765", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                mode: "cors",
                body: JSON.stringify({ action, version: 6, params })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);

            const json = await response.json();
            if (json.error) throw new Error(json.error);

            return json.result;
        } catch (error) {
            alert("AnkiConnect Error: " + error.message);
            return null;
        }
    }

    async function fetchDueCards(dueDays) {
        let decks = await ankiRequest("deckNames");
        if (!decks) return [];

        let wordsToHighlight = [];

        for (let deck of decks) {
            let cardIds = await ankiRequest("findCards", { query: `deck:${deck}` });
            if (!cardIds || cardIds.length === 0) continue;

            let cardsInfo = await ankiRequest("cardsInfo", { cards: cardIds });
            if (!cardsInfo) continue;

            cardsInfo.forEach(card => {
                let dueTime = parseInt(dueDays, 10) || 0;
                if (card.due <= dueTime || card.due >= 1737900000) {
                    wordsToHighlight.push(`${card.fields.Front.value};${card.cardId};${card.due};${card.deckName}`);
                }
            });
        }
        return wordsToHighlight;
    }

    function createPopup() {
        let popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.top = '10%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, 0)';
        popup.style.backgroundColor = 'white';
        popup.style.padding = '15px';
        popup.style.boxShadow = '0px 4px 8px rgba(0,0,0,0.2)';
        popup.style.zIndex = '10000';
        popup.style.borderRadius = '8px';

        let input = document.createElement('input');
        input.type = 'number';
        input.placeholder = 'Enter due days (default 0)';
        input.style.marginBottom = '10px';
        popup.appendChild(input);

        let button = document.createElement('button');
        button.textContent = 'Fetch Due Cards';
        button.onclick = async function() {
            let dueDays = input.value || "0";
            let words = await fetchDueCards(dueDays);

            if (words.length === 0) return alert('No due words found');

            let textarea = document.createElement('textarea');
            textarea.value = words.join('\n');
            textarea.style.width = '100%';
            textarea.style.height = '150px';
            popup.appendChild(textarea);
        };
        popup.appendChild(button);

        let closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.marginLeft = '10px';
        closeButton.onclick = () => document.body.removeChild(popup);
        popup.appendChild(closeButton);

        document.body.appendChild(popup);
    }

    createPopup();
})();



```