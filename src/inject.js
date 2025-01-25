try {
try {

;(() => {
  ////////////////////////////////////////////////////////////////////////////
  // Variables
  ////////////////////////////////////////////////////////////////////////////

  // set to true when we are recording transcriptions
  let isShowing = false;

  let isTextAreaCreated = null;
  let buttons = null;

  let text_color;
  let tab_text = [];
  ////////////////////////////////////////////////////////////////////////////
  // Constants
  ////////////////////////////////////////////////////////////////////////////

  // Version of the format for localstorage data
  const LOCALSTORAGE_VERSION = 1;
  let DEBUG;

  // -------------------------------------------------------------------------
  // make a localStorage key with the version prefixed
  // -------------------------------------------------------------------------
  const makeFullKey = (key, version = LOCALSTORAGE_VERSION) => {
    let versionPostfix = version === null ? '' : `_v${version}`;
    return `__gmla${versionPostfix}_${key}`;
  };

  // -------------------------------------------------------------------------
  // retrieve a key from localStorage parsed as JSON
  // -------------------------------------------------------------------------
  const get = (key, version) => {
    const raw = window.localStorage.getItem(makeFullKey(key, version));
    if (typeof raw === 'string' || raw instanceof String) {
      debug(key, raw);
      return JSON.parse(raw);
    } else {
      return raw;
    }
  };

  // -------------------------------------------------------------------------
  // retrieve a key in localStorage stringified as JSON
  // -------------------------------------------------------------------------
  const set = (key, value, version) => {
    window.localStorage.setItem(makeFullKey(key, version), JSON.stringify(value));
  };

  // -------------------------------------------------------------------------
  // delete a key from localStorage
  // -------------------------------------------------------------------------
  const remove = (key, version) => {
    debug(`remove ${makeFullKey(key, version)}`);

    if (!READONLY) {
      window.localStorage.removeItem(makeFullKey(key, version));
    }
  };

  // -------------------------------------------------------------------------
  // get a key from local storage and set it to the default if it doesn't
  // exist yet
  // -------------------------------------------------------------------------
  const getOrSet = (key, defaultValue, version) => {
    const value = get(key, version);

    if (value === undefined || value === null) {
      set(key, defaultValue, version);
      return defaultValue;
    } else {
      return value;
    }
  }

  // -------------------------------------------------------------------------
  // increment a key in local storage, set to to 0 if it doesn't exist
  // -------------------------------------------------------------------------
  const increment = (key, version) => {
    const current = get(key, version);

    if (current === undefined || current === null) {
      set(key, 0);
      return 0;
    } else {
      let next = current + 1;
      set(key, next);
      return next;
    }
  }

  ////////////////////////////////////////////////////////////////////////////
  // DOM Utilities
  ////////////////////////////////////////////////////////////////////////////

  // -------------------------------------------------------------------------
  // execute an xpath query and return the first matching node
  // -------------------------------------------------------------------------
  const xpath = (search, root = document) => {
    return document.evaluate(search, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue;
  };

  // -------------------------------------------------------------------------
  // sync settings from localStorage
  // -------------------------------------------------------------------------
  const getAllStorageSyncData = () => {
    // Immediately return a promise and start asynchronous work
    return new Promise((resolve) => {
      // Asynchronously fetch all data from storage.sync.
      chrome.storage.sync.get({
      window_positions: '{"z_index":"65000","elem_others.style.width":"1000px","elem_others.style.top":"300px","fixed_part_of_utterance.style.width":"800px","buttons.style.top":"100px"}',
      text_color: "#FFFFFF",
      background_color: "#000000",
      tab_text:'Default',
    }, (items) => {
        // resolve(is_synced = true);
        is_synced = true
        // Pass any observed errors down the promise chain.
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        // Pass the data retrieved from storage down the promise chain.
        window_positions =       items.window_positions;
        text_color =             items.text_color;
        background_color =       items.background_color;
        tab_text =               items.tab_text;
        setTextArray(tab_text);
        applyFontColor(text_color,background_color);
        applyOptionStyles();
      });
    });
  }

  // -------------------------------------------------------------------------
  // //console.log only if DEBUG is false
  // -------------------------------------------------------------------------
  const debug = (...args) => {
    if (DEBUG) {
      console.log('[anki highlighter]', ...args);
    }
  };

  const tryTo = (fn, label) => async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      console.error(`error ${label}:`, e);
    }
  };


  // If you prefer to run automatically on page load, call `main()` at the end.
  // Here, we wait for a hotkey to keep it manual.
  document.addEventListener('keydown', function(e) {
    // e.g. SHIFT + H to trigger
    if (e.shiftKey && e.key === 'H') {
      alert("Reading Anki deck")
      retrieve_and_show_vocabs();
    }
  });

  // Helper that uses GM_xmlhttpRequest to POST JSON to AnkiConnect
  async function ankiRequest(action, params) {
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
      return response.json();
    }
  }

  async function retrieve_and_show_vocabs() {
    let targetDeckName = tab_text;
    try {
      // 1) Get deck names and IDs
      const decks = await ankiRequest("deckNamesAndIds",null);
      if (!decks) {
        alert(`Decks are not found.`);
        return;
      }

      // 2) Find cards in the chosen deck
      //Object.keys(decks.result)[0]
      const cardIds = await ankiRequest("findCards", { query: `deck:${targetDeckName}` });
      if (!cardIds || cardIds.result.length === 0) {
        alert(`No cards found in deck "${targetDeckName}".`);
        return;
      }

      // 3) Get detailed info for these cards
      const cardsInfo = await ankiRequest("cardsInfo", { cards: cardIds.result });
      if (!cardsInfo || !cardsInfo.result.length) {
        alert("No card info returned.");
        return;
      }

      // Extract each Front field
      const wordsToHighlight = cardsInfo.result.map(info => info.fields.Front.value);
      alert("Returned cards"+wordsToHighlight)
      // 4) Highlight them in the current page
      highlightTerms(wordsToHighlight);
      alert("Highlighting complete!");

    } catch (error) {
      alert("Error: " + error.message);
    }
  }

  // -------------------------------------------
  // Simple text highlighting
  function highlightTerms(terms) {
    // For each term, we do a naive text replacement
    terms.forEach(term => highlightTerm(term));
  }

  function highlightTerm(term) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach(node => {
      const parent = node.parentNode;
      if (!node.nodeValue) return;

      // For case-insensitive matching, use "gi" instead of "g" below.
      const re = new RegExp(term, "gi");
      const replaced = node.nodeValue.replace(re, match => {
        return `<span style="background: ${background_color}; ">${match}</span>`;
      });

      if (replaced !== node.nodeValue) {
        const wrapper = document.createElement("span");
        wrapper.innerHTML = replaced;
        parent.replaceChild(wrapper, node);
      }
    });
  }



  const open_option_dialog = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      let dialog = document.createElement('dialog');
      let request = new Request(chrome.runtime.getURL('options.html'));
      fetch(request).then( function(response){
        return response.text().then( function(text) {
          dialog.innerHTML = text;

          dialog.oncancel = function(){
            dialog.remove();
          }
          const update_select_language = () => {

            // const speava_select_language = document.getElementById('select_language');
            // for (var i = 0; i < langs.length; i++) {
            //   speava_select_language.options[i] = new Option(langs[i][0], i);
            // }
            // Set default language / dialect.
            // select_language.selectedIndex = 10;
            // updateCountry();
            // select_dialect.selectedIndex = 11;
            //showInfo('info_start');
          }
          const save_options = () => {
            window_positions = document.getElementById('window_positions').value;
            text_color = document.getElementById('text_color').value;
            background_color = document.getElementById('background_color').value;
            tab_text = document.getElementById('tab_text').value;
            // var element_speava_select_language = document.getElementById('select_language');
            // var element_speava_select_dialect = document.getElementById('select_dialect');
            // var speava_select_language_value = langs[element_speava_select_language.options.selectedIndex];
            // speava_select_language = element_speava_select_dialect.value;

            applyFontColor(text_color,background_color);
            applyOptionStyles();
            setTextArray(tab_text);
            chrome.storage.sync.set({
              window_positions: window_positions,
              text_color: text_color,
              background_color: background_color,
              tab_text: tab_text,
            }, function() {
              var status = document.getElementById('status');
              status.textContent = 'Options saved.';
              setTimeout(function() {
                status.textContent = '';
                dialog.remove();
              }, 750);
            });
          }
          // const updateCountry = () => {
          //   const speava_select_language = document.getElementById('select_language');
          //   const speava_select_dialect = document.getElementById('select_dialect');
          //   for (var i = speava_select_dialect.options.length - 1; i >= 0; i--) {
          //     speava_select_dialect.remove(i);
          //   }
          //   var list = langs[speava_select_language.selectedIndex];
          //   for (var i = 1; i < list.length; i++) {
          //     speava_select_dialect.options.add(new Option(list[i][1], list[i][0]));
          //   }
          //   speava_select_dialect.style.visibility = list[1].length == 1 ? 'hidden' : 'visible';
          // }
          // const list_of_codes = (language_code) => {
          //   let list_code = [];
          //   let list_counter = -1;
          //   let found_at = 0;
          //   langs.forEach(item => {
          //     if (item[1].length === 1){
          //       // console.log(item[1][0])
          //       list_counter++;
          //       if (item[1][0] === language_code){
          //         found_at = list_counter;
          //         // return list_counter;
          //       }
          //
          //     } else {
          //       list_counter++;
          //       item.forEach(subitem => {
          //         if (subitem.length===2){
          //           // console.log(subitem[0])
          //           // list_code.push([subitem[0],list_counter]);
          //           if (subitem[0] === language_code){
          //             found_at = list_counter;
          //             // return list_counter;
          //           }
          //         }
          //       } )
          //     }
          //   });
          //   return found_at;
          // }
          const restore_options = () => {
            chrome.storage.sync.get({
              window_positions: '{"z_index":"65000","elem_others.style.width":"1000px","elem_others.style.top":"300px","fixed_part_of_utterance.style.width":"800px","buttons.style.top":"100px"}',
              text_color: "#FFFFFF",
              background_color: "#000000",
              tab_text:'Default',
              speava_select_language: 'en-US'
            }, function(items) {
              document.getElementById('window_positions').value = items.window_positions;
              document.getElementById('text_color').value = items.text_color;
              document.getElementById('background_color').value = items.background_color;
              document.getElementById('tab_text').value = items.tab_text;
              const item_number = list_of_codes( items.speava_select_language);
              document.getElementById('select_language').value = item_number;
              // updateCountry();
              // dialect has to be set after script populats country values
              document.getElementById('select_dialect').value = items.speava_select_language;

            });
          }
          document.body.appendChild(dialog);
          dialog.showModal();
          update_select_language();
          restore_options();
          document.getElementById('option_save').addEventListener('click',
            save_options);
            });
          });
    }
  }

  // -------------------------------------------------------------------------
  // Toggle adhoc button
  // -------------------------------------------------------------------------
  const turnCaptionsOn_adhoc = () => {
    recognition.lang = speava_select_language;
    const captionsButtonOn = xpath(`//button[@id="webkit_speech_recognition_toggle"]`, document);
    if (captionsButtonOn) {
      if (!captionsButtonOn.classList.contains("speava_button_active")) {
        // captionsButtonOn.click();
        captionsButtonOn.classList.add("speava_button_active");
        recognition.start()
      }
      weTurnedCaptionsOn = true;
    }
  }

  const turnCaptionsOff_adhoc = () => {
    const captionsButtonOff =  xpath(`//button[@id="webkit_speech_recognition_toggle"]`, document);
    if (captionsButtonOff) {
      if (captionsButtonOff.classList.contains("speava_button_active")){
        // captionsButtonOff.click();
        captionsButtonOff.classList.remove("speava_button_active");
      }
      weTurnedCaptionsOn = false;
    }
    recognition.stop();
  }


  const addButtons = () => {
    if (is_synced === null){
      return;
    }
    if (isTextAreaCreated === null) {
      const elem = document.createElement('div');
      elem.id = "space_textarea";
      elem.style.top = "0px"
      elem.style.witdh = "300px"
      elem.style.font.fontcolor(text_color);
      const text = document.createTextNode('Show stats');
      const objBody = document.getElementsByTagName("body").item(0);

      isTextAreaCreated = true;

      const objBody_buttons = document.getElementsByTagName("body").item(0);
      buttons = document.createElement('div');
      isShowing = true;
      buttons.id = "buttons";
      buttons.style.position = 'absolute';
      objBody_buttons.appendChild(buttons);

      const url_icon_config = chrome.runtime.getURL("icons/icon_config.png");
      const open_options = () => open_option_dialog();
      const _PNG_CONFIG = {
        viewBoxWidth: 448,
        viewBoxHeight: 512,
        path: url_icon_config,
      };
      const configButton = document.createElement('div');
      buttons.prepend(configButton);
      configButton.style.display = 'flex';
      configButton.style.position = 'relative';
      configButton.style.float = 'left';
      configButton.appendChild(makePng(_PNG_CONFIG, 36, 36, { id: "config", onclick: open_options }));

      applyFontColor(text_color,background_color);
      applyOptionStyles();
    }

  };

  const setTextArray = (inText) => {
    const dataArray = [];
    let procssing_text = inText;
    procssing_text = procssing_text.replace('\r\n','\n');
    procssing_text = procssing_text.replace('\n\r','\n');
    const dataString = procssing_text.split('\n');
    tab_text_array = dataString;
  }

  ////////////////////////////////////////////////////////////////////////////
  // read aloud
  ////////////////////////////////////////////////////////////////////////////

  let read_list_of_elements = [];
  let last_selected_fragment = null;
  let current_item_in_list = 0;
  let current_sequence_number_in_item = 0;
  let current_sequence_number_in_item_from = 0;
  let current_sequence_number_in_item_to = 0;
  let target_text = "";
  let interimTranscriptReadAloud = "";
  let current_selected_from = 0;
  let current_selected_to = 0;


  // -------------------------------------------------------------------------
  // Stop transcribing
  // -------------------------------------------------------------------------
  const stopTranscribing = () => {
    turnCaptionsOff_adhoc();
  }

  // -------------------------------------------------------------------------
  // Start transcribing
  // -------------------------------------------------------------------------
  const startTranscribing = () => {
    turnCaptionsOn_adhoc();
  }

  const makePng = ({ viewBoxWidth, viewBoxHeight, path }, widthPx, heightPx, options = {}) => {
    const png = document.createElement('img');
    png.style.width = `${widthPx}px`;
    png.style.height = `${heightPx}px`;
    png.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
    png.src = path;

    png.id = options.id ? options.id : '';
    if (options.className) {
      png.classList.add(options.className);
    }
    png.onclick = options.onclick ? options.onclick : null;

    return png;
  };

  const applyFontColor = (font_color, background_color) => {

    const all_others = document.getElementById("all_others");
    const counting_number = document.getElementById("counting_number");
    const fixed_part_of_utterance = document.getElementById("fixed_part_of_utterance");
    const interim_part_of_utterance = document.getElementById("interim_part_of_utterance");
    if (all_others) {
      all_others.style.color = font_color;
      all_others.style.backgroundColor = background_color;
    }
    if (counting_number){
      counting_number.style.color = font_color;
      counting_number.style.backgroundColor = background_color;
      counting_number.style.fontSize = "30px";

    }
    if (fixed_part_of_utterance) {
      fixed_part_of_utterance.style.color = font_color;
      fixed_part_of_utterance.style.backgroundColor = background_color;
      fixed_part_of_utterance.style.fontSize = "30px";
    }
    if (interim_part_of_utterance) {
      interim_part_of_utterance.style.color = font_color;
      interim_part_of_utterance.style.backgroundColor = background_color;
      interim_part_of_utterance.style.fontSize = "30px";
    }

  }

  const addPxString = (outPxNumber) =>{
    let outputString = "";
    outputString = outPxNumber.toString() + "px";
    return outputString;
  }

  const applyOptionStyles = () => {

    const all_others = document.getElementById("all_others");
    const fixed_part_of_utterance = document.getElementById("fixed_part_of_utterance");
    const buttons_for_command = document.getElementById("buttons");

    let parsed_json = null;
    let buttons_style_top = '0px';
    let buttons_style_right = '100px';
    let fixed_part_of_utterance_style_top = null;
    let fixed_part_of_utterance_style_right = null;
    let fixed_part_of_utterance_style_width = null;
    let elem_others_style_top = '0px';
    let elem_others_style_right = null;
    let elem_others_style_width = null;
    let z_index = 65000;
    let factor_top = parseInt(1 * +1 * scrollY);
    try {
      parsed_json = JSON.parse(window_positions);
      if ('buttons.style.top' in parsed_json){
        buttons_style_top = parseInt(parsed_json["buttons.style.top"]) + factor_top;
      }
      if ('buttons.style.right' in parsed_json){
        buttons_style_right = parsed_json["buttons.style.right"];
      }
      if ('fixed_part_of_utterance.style.right' in parsed_json){
        fixed_part_of_utterance_style_right = parsed_json["fixed_part_of_utterance.style.right"];
      }
       if ('fixed_part_of_utterance.style.top' in parsed_json){
        fixed_part_of_utterance_style_top = parseInt(parsed_json["fixed_part_of_utterance.style.top"]) + factor_top;
      }
      if ('fixed_part_of_utterance.style.width' in parsed_json){
        fixed_part_of_utterance_style_width = parsed_json["fixed_part_of_utterance.style.width"];
      }
      if ('elem_others.style.right' in parsed_json){
        elem_others_style_right = parsed_json["elem_others.style.right"];
      }
       if ('elem_others.style.top' in parsed_json){
        elem_others_style_top = parseInt(parsed_json["elem_others.style.top"]) + factor_top;
      }
      if ('elem_others.style.width' in parsed_json){
        elem_others_style_width = parsed_json["elem_others.style.width"];
      }

      if ('z_index' in parsed_json){
        z_index = parsed_json["z_index"];
      }
    } catch (e) {
      console.log(`error window_positions parse:`, e);
    }
    if (all_others){
      all_others.style.zIndex = z_index;
      all_others.style.top = addPxString(elem_others_style_top);
      if (elem_others_style_right) {
        all_others.style.right = elem_others_style_right;
      }
      if (elem_others_style_width) {
        all_others.style.width = elem_others_style_width;
      }
    }
    if (fixed_part_of_utterance){
      fixed_part_of_utterance.style.zIndex = z_index;
      if (fixed_part_of_utterance_style_top) {
        fixed_part_of_utterance.style.top = addPxString(fixed_part_of_utterance_style_top);
      }
      if (fixed_part_of_utterance_style_right){
        fixed_part_of_utterance.style.right = fixed_part_of_utterance_style_right;
      }
      if (fixed_part_of_utterance_style_width) {
        fixed_part_of_utterance.style.width = fixed_part_of_utterance_style_width;
      }
    }
    if (buttons_for_command){
      buttons_for_command.style.zIndex = z_index;
      buttons_for_command.style.top = addPxString(buttons_style_top);
      buttons_for_command.style.right = buttons_style_right;
    }
  }

  const toast_to_notify = (input_text, duration) => {
    let dialog = document.createElement('dialog');
    dialog.innerHTML = input_text;
    document.body.appendChild(dialog);
    dialog.oncancel = function(){
      dialog.remove();
    }
    dialog.showModal();
    setTimeout( function() {dialog.remove();}, duration);
  }

  ////////////////////////////////////////////////////////////////////////////
  // Main App
  ////////////////////////////////////////////////////////////////////////////

  console.log(`starting`);
  is_synced = null;
  getAllStorageSyncData();
  setInterval(tryTo(addButtons, 'adding buttons'), 500);
  window.addEventListener("scroll", (event) => {
      applyOptionStyles();
  });

})();

} catch (e) {
  console.error('init error', e);
}

} catch (e) {
  console.log('error injecting script', e);
}