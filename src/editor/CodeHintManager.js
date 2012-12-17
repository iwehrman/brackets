/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */


/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, window, brackets */

define(function (require, exports, module) {
    "use strict";
    
    // Load dependent modules
    var KeyEvent        = require("utils/KeyEvent"),
        CodeHintList    = require("editor/CodeHintList").CodeHintList;

    var hintProviders = {},
        lastChar,
        sessionProvider,
        sessionEditor,
        hintList;

    /**
     * Comparator to sort providers based on their specificity
     */
    function _providerSort(a, b) {
        return b.specificity - a.specificity;
    }

    /** 
     *  Return the array of hint providers for the given mode.
     *  If this is called for the first time, then we check if any provider wants to show
     *  hints on all modes. If there is any, then we merge it into each individual
     *  mode provider list.
     *
     * @param {(string|Object<name: string>)} mode
     * @return {Array.<{provider: Object, modes: Array.<string>, specificity: number}>}
     */
    function _getProvidersForMode(mode) {

        var allModeProviders;
        if (hintProviders.all) {
            allModeProviders = hintProviders.all;
            
            // Remove "all" mode list since we don't need it any more after
            // merging them to each individual mode provider lists.
            delete hintProviders.all;
            
            $.each(hintProviders, function (key, value) {
                if (hintProviders[key]) {
                    hintProviders[key] = hintProviders[key].concat(allModeProviders);
                    hintProviders[key].sort(_providerSort);
                }
            });
        }
        
        var modeName = (typeof mode === "string") ? mode : mode.name;
        return hintProviders[modeName] || [];
    }
    
    /** 
     * Is there a hinting session active? 
     */
    function _inSession() {
        return !!sessionProvider;
    }

    /**
     * End the current hinting session
     */
    function _endSession() {
        console.log("_endSession");

        hintList.close();
        hintList = null;
        sessionProvider = null;
        sessionEditor = null;

        if (lastChar !== null) {
            throw "lastChar is not null at session end!";
        }
    }
    
    /**
     * From an active hinting session, get hints from the current provider and
     * render the hint list window.
     */
    function _updateHintList() {
        console.log("_updateHintList");

        if (!_inSession()) {
            throw "Updated hint list outside of a session";
        }

        var response = sessionProvider.getHints(lastChar);
        lastChar = null;

        if (!response) {
            _endSession();
        } else if (hintList.isOpen()) {
            hintList.update(response);
        } else {
            hintList.open(response);
        }
    }
    
    /**
     * Try to begin a new hinting session with the given editor. 
     */
    function _beginSession(editor) {
        console.log("_beginSession");

        // Find a suitable provider, if any
        var mode = editor.getModeForSelection(),
            enabledProviders = _getProvidersForMode(mode);
        
        $.each(enabledProviders, function (index, item) {
            if (item.provider.hasHints(editor, lastChar)) {
                sessionProvider = item.provider;
                return false;
            }
            return true;
        });

        // If a provider is found, initialize the hint list and update it
        if (sessionProvider) {
            sessionEditor = editor;

            hintList = new CodeHintList(sessionEditor);
            hintList.onSelect(function (hint) {
                var restart = sessionProvider.insertHint(hint),
                    previousEditor = sessionEditor;
                _endSession();
                if (restart) {
                    _beginSession(previousEditor);
                }
            });
            hintList.onClose(_endSession);

            _updateHintList();
        }
    }

    /**
     * TODO: This documentation is out of date. Needs to be updated with new Provider API
     * from https://github.com/adobe/brackets/wiki/New-Code-Hinting-API-Proposal
     * 
     * Registers an object that is able to provide code hints. When the user requests a code
     * hint getQueryInfo() will be called on every hint provider. Providers should examine
     * the state of the editor and return a search query object with a filter string if hints 
     * can be provided. search() will then be called allowing the hint provider to create a 
     * list of hints for the search query. When the user chooses a hint handleSelect() is called
     * so that the hint provider can insert the hint into the editor.
     *
     * @param {Object.< getQueryInfo: function(editor, cursor),
     *                  search: function(string),
     *                  handleSelect: function(string, Editor, cursor),
     *                  shouldShowHintsOnKey: function(string),
     *                  wantInitialSelection: function()>}
     *
     * Parameter Details:
     * - getQueryInfo - examines cursor location of editor and returns an object representing
     *      the search query to be used for hinting. queryStr is a required property of the search object
     *      and a client may provide other properties on the object to carry more context about the query.
     * - search - takes a query object and returns an array of hint strings based on the queryStr property
     *      of the query object.
     * - handleSelect - takes a completion string and inserts it into the editor near the cursor
     *      position. It should return true by default to close the hint list, but if the code hint provider
     *      can return false if it wants to keep the hint list open and continue with a updated list. 
     * - shouldShowHintsOnKey - inspects the char code and returns true if it wants to show code hints on that key.
     * - wantInitialSelection - return true if the provider wants to select the first hint item by default.
     *
     * @param {Array.<string>} modes  An array of mode strings in which the provider can show code hints or "all" 
     *      if it can show code hints in any mode.
     * @param {number} specificity  A positive number to indicate the priority of the provider. The larger the number, 
     *      the higher priority the provider has. Zero if it has the lowest priority in displaying its code hints.
     */
    function registerHintProvider(providerInfo, modes, specificity) {
        var providerObj = { provider: providerInfo,
                            specificity: specificity || 0 };
                
        if (modes) {
            modes.forEach(function (mode) {
                if (mode) {
                    if (!hintProviders[mode]) {
                        hintProviders[mode] = [];
                    }
                    hintProviders[mode].push(providerObj);
                    
                    if (hintProviders[mode].length > 1) {
                        hintProviders[mode].sort(_providerSort);
                    }
                }
            });
        }
    }

    /**
     * Handles keys related to displaying, searching, and navigating the hint list. 
     * This gets called before handleChange.
     * @param {Editor} editor
     * @param {KeyboardEvent} event
     */
    function handleKeyEvent(editor, event) {
        if (_inSession() && editor !== sessionEditor) {
            _endSession();
        }

        if (event.type === "keydown") {
            if (event.keyCode === 32 && event.ctrlKey) {
                event.preventDefault();

                if (_inSession()) {
                    _endSession();
                }

                lastChar = null;
                console.log("New explicit session");
                _beginSession(editor);
            }
        } else if (event.type === "keypress") {
            console.log("keypress: " + event.charCode);
            lastChar = String.fromCharCode(event.charCode);
        } else if (event.type === "keyup") {
            if (_inSession()) {
                if (event.keyCode !== 32 && event.ctrlKey) {
                    _endSession();
                } else if (event.keyCode === KeyEvent.DOM_VK_LEFT ||
                        event.keyCode === KeyEvent.DOM_VK_RIGHT) {
                    _updateHintList();
                }
            }
        }

        // Pass to the hint list, if it's open
        if (hintList && hintList.isOpen()) {
            hintList.handleKeyEvent(event);
        }
    }
    
    /**
     * Start a new implicit hinting session, or update the existing hint list. 
     * Called by the editor after handleKeyEvent, which is responsible for setting
     * the lastChar.
     */
    function handleChange(editor) {
        // FIXME: end the session on "complex" changes
        if (!_inSession() && lastChar) {
            console.log("New implicit session: " + lastChar);
            _beginSession(editor);
        } else if (_inSession()) {
            _updateHintList();
        }
    }
    
    /**
     * Expose CodeHintList for unit testing
     */
    function _getCodeHintList() {
        return hintList;
    }
    
    // Define public API
    exports.handleKeyEvent          = handleKeyEvent;
    exports.handleChange            = handleChange;
    exports._getCodeHintList        = _getCodeHintList;
    exports.registerHintProvider    = registerHintProvider;
});
