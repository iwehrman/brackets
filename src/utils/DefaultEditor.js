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
/*global define, $, brackets */

define(function (require, exports, module) {
    "use strict";
    
    var AppInit                 = require("utils/AppInit"),
        Dialogs                 = require("widgets/Dialogs"),
        DefaultDialogs          = require("widgets/DefaultDialogs"),
        Strings                 = require("strings"),
        PreferencesManager      = require("preferences/PreferencesManager");
    
    // string constants
    var PREFS_DEFAULT_EDITOR_PROMPTED = "DefaultEditorPrompted",
        FILEEXT_JS = ".js",
        FILEEXT_CSS = ".css";
    
    /**
     * @private
     * @type {PreferenceStorage}
     */
    var _prefs = {};
    
    /**
     * @private
     * @type {PreferenceStorage}
     */
    var _defaultPrefs = { DefaultEditorPrompted: false };   // default to first-launch state
    
    /**
     * Conditionally prompts the user to register the app as the default editor for JS and CSS files
     *
     * @return None.
     */
    function promptForDefaultEditor() {
        // only prompt on Windows and if we haven't prompted before (ie. first launch)
        if ((brackets.platform === "win") && (!_prefs.getValue(PREFS_DEFAULT_EDITOR_PROMPTED))) {
            Dialogs.showModalDialog(
                DefaultDialogs.DIALOG_ID_DEFAULT_EDITOR,
                Strings.DEFAULT_EDITOR_TITLE,
                Strings.DEFAULT_EDITOR_MESSAGE,
                [
                    {
                        className : Dialogs.DIALOG_BTN_CLASS_NORMAL,
                        id        : Dialogs.DIALOG_BTN_NO,
                        text      : Strings.BUTTON_NO
                    },
                    {
                        className : Dialogs.DIALOG_BTN_CLASS_PRIMARY,
                        id        : Dialogs.DIALOG_BTN_YES,
                        text      : Strings.BUTTON_YES
                    }
                ]
            )
                .done(function (id) {
                    if (id === Dialogs.DIALOG_BTN_YES) {
                        // register as default editor for specific file types
                        brackets.app.setRegistrationAsDefaultEditor(FILEEXT_JS);
                        brackets.app.setRegistrationAsDefaultEditor(FILEEXT_CSS);
                    } else if (id === Dialogs.DIALOG_BTN_NO) {
                        // clear any previous registration as the default editor for these file types
                        brackets.app.clearRegistrationAsDefaultEditor(FILEEXT_JS);
                        brackets.app.clearRegistrationAsDefaultEditor(FILEEXT_CSS);
                    }
                    
                    // make note in prefs that we've already asked once
                    _prefs.setValue(PREFS_DEFAULT_EDITOR_PROMPTED, true);
                });
        }
    }

    // Initialize the PreferenceStorage
    _prefs = PreferencesManager.getPreferenceStorage(module, _defaultPrefs);

    // called after all modules and extensions have been loaded
    AppInit.appReady(function () {
        promptForDefaultEditor();
    });

    // Export public API
    exports.promptForDefaultEditor  = promptForDefaultEditor;
});
