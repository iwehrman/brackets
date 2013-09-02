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
        Global                  = require("utils/Global"),
        Dialogs                 = require("widgets/Dialogs"),
        DefaultDialogs          = require("widgets/DefaultDialogs"),
        Strings                 = require("strings"),
        PreferencesManager      = require("preferences/PreferencesManager");
    
    /**
     * @private
     * @type {PreferenceStorage}
     */
    var _prefs = {};
    
    /**
     * @private
     * @type {PreferenceStorage}
     */
    var _defaultPrefs = { DefaultEditorPrompted: false };
    
    //BSCTODO:
    // x1. only for Windows
    // 2. restore if set before?
	
    //var fileExt = ".abc";
    //brackets.app.checkRegistrationAsDefaultEditor(
    //    fileExt,
    //    function (err, isDefault) {
    //        var x = 1;
    //        var y = 2;
    //        var z = x + y;
    //        ++z;
    //    } /* Ignore errors */
    //);
    //brackets.app.setRegistrationAsDefaultEditor(
    //    fileExt,
    //    function (err) {} /* Ignore errors */
    //);
    //brackets.app.clearRegistrationAsDefaultEditor(
    //    fileExt,
    //    function (err) {} /* Ignore errors */
    //);
    
    /**
     * Conditionally prompts the user to register the app as the default editor for JS and CSS files
     *
     * @return None.
     */
    function promptForDefaultEditor() {
        // only prompt on Windows and if we haven't prompted before (ie. first launch)
        if ((brackets.platform === "win") && (!_prefs.getValue("DefaultEditorPrompted"))) {
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
                        // register as default editor for given file types
                        brackets.app.setRegistrationAsDefaultEditor(".js", function (err) {} /* Ignore errors */);
                        brackets.app.setRegistrationAsDefaultEditor(".css", function (err) {} /* Ignore errors */);
                    }
                    
                    // make note in prefs that we've already asked once
                    _prefs.setValue("DefaultEditorPrompted", true);
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
