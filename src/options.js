// Saves options to chrome.storage
function save_options() {
  var window_positions = document.getElementById('window_positions').value;
  var text_color = document.getElementById('text_color').value;
  var background_color = document.getElementById('background_color').value;
  var tab_text = document.getElementById('tab_text').value;
  var due_days = document.getElementById('due_days').value;

  chrome.storage.sync.set({
    window_positions: window_positions,
    text_color: text_color,
    background_color: background_color,
    tab_text: tab_text,
    due_days: due_days
  }, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.sync.get({
    window_positions: '{"z_index":"65000","elem_others.style.width":"1000px","elem_others.style.top":"300px","fixed_part_of_utterance.style.width":"800px",,"buttons.style.top":"100px"}',
    text_color: "#FFFFFF",
    background_color: "#000000",
    tab_text:'word\tdef\tdetails\ntest\ttest def\ttest detail description',
    due_days: ""
  }, function(items) {
    document.getElementById('window_positions').value = items.window_positions;
    document.getElementById('text_color').value = items.text_color;
    document.getElementById('background_color').value = items.background_color;
    document.getElementById('tab_text').value = items.tab_text;
    document.getElementById('due_days').value = items.due_days;
  });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('option_save').addEventListener('click',
    save_options);

const updateDecks = () => {
    retrieve_and_show_decks();
}

  async function ankiRequestConfig(action, params) {
    let body_json;
    if (params != null){
      body_json = JSON.stringify({
        action: action,
        version: 6,
        params: params
      })
    } else {
      body_json = JSON.stringify({
        action: action,
        version: 6,
      })
    }
    const response = await fetch("http://localhost:8765", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      // change AnkiConnect addon's permission through Addon config to set address to *
      mode: "cors",
      body: body_json
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      alert("Ensure Anki and AnkiConnect are up and running. Extension failed connect to AnkiConnect")
    } else {
      console.log(response);
      return response.json();
    }
  }
  function reflect_deck_selections_to_text(){
    const select_deck_area = document.getElementById('select_decks');
    const select_deck_text = document.getElementById('tab_text');
    const selected_deck_list = select_deck_text.value.split("\n");
    let blank_text_entries = "";
    for (var i = select_deck_area.children.length - 1; i >= 0; i--) {
      if (select_deck_area.children[i].getElementsByTagName("input")[0].checked){
          blank_text_entries = blank_text_entries + select_deck_area.children[i].getElementsByTagName("input")[0].name + "\n";
      } else {

      };
    }
    select_deck_text.value = blank_text_entries;


}
  async function retrieve_and_show_decks() {

    try {
      // 1) Get deck names and IDs
      const decks = await ankiRequestConfig("deckNamesAndIds",null);
      if (!decks) {
        alert(`Decks are not found.`);
        return;
      } else {
        const select_deck_area = document.getElementById('select_decks');
        for (var i = select_deck_area.children.length - 1; i >= 0; i--) {
          select_deck_area.children[0].remove();
        }
        const select_deck_text = document.getElementById('tab_text');
        const selected_deck_list = select_deck_text.value.split("\n");
        Object.entries(decks.result).forEach(deck => {
              // speava_select_language.options.add(new Option(deck[0], deck[1]));
              const label = document.createElement("label");
              const checkbox = document.createElement("input");
              checkbox.type="checkbox";
              checkbox.id=`${deck[1]}`;
              checkbox.name=`${deck[0]}`;
              checkbox.onclick = function(){
                  reflect_deck_selections_to_text();
              }

              // checkbox.onclick = function(event){
              //     console.log(event.target.id,event.target.name,event.target.checked);
              // }
              const textContent = document.createTextNode(deck[0]);
// populate the selected deck
              if (selected_deck_list.indexOf(`${deck[0]}`)!=-1){
                  checkbox.checked = true;
              } else {
                  checkbox.checked = false;
              }

              label.appendChild(checkbox);
              label.appendChild(textContent);
              select_deck_area.appendChild(label);
        });
      }
    } catch (error) {
      alert("Error: " + error.message);
    }
  }

updateDecks();