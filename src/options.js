// Saves options to chrome.storage
function save_options() {
  var window_positions = document.getElementById('window_positions').value;
  var text_color = document.getElementById('text_color').value;
  var background_color = document.getElementById('background_color').value;
  var tab_text = document.getElementById('tab_text').value;

  chrome.storage.sync.set({
    window_positions: window_positions,
    text_color: text_color,
    background_color: background_color,
    tab_text: tab_text,
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
  }, function(items) {
    document.getElementById('window_positions').value = items.window_positions;
    document.getElementById('text_color').value = items.text_color;
    document.getElementById('background_color').value = items.background_color;
    document.getElementById('tab_text').value = items.tab_text;
  });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('option_save').addEventListener('click',
    save_options);

document.getElementById('select_language').addEventListener('change', updateCountry);