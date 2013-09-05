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
     * Check if the app is the default editor for the given file type.
     *
     * @param {string} file extension (eg. ".ext") to check
     *
     * @return {$.Promise} a jQuery promise that resolves with a boolean indicating
     *                     whether the app is currently the default editor
     */
    function checkIfDefaultEditorFor(fileExt) {
        var result = new $.Deferred();
        if (brackets.platform === "win") {
            brackets.app.checkIfDefaultEditorFor(
                fileExt,
                function(err, isDefault) {
                    if (err !== brackets.app.NO_ERROR) {
                        result.reject(err);
                    } else {
                        result.resolve(isDefault);
                    }
                }
            );
        } else {
            result.resolve(false);
        }
        return result.promise();
    }
    
    /**
     * Registers the app to be the default editor for the given file type.
     *
     * @param {string} file extension (eg. ".ext") to register
     *
     * @return {$.Promise} a jQuery promise that rejects with an error if unable to register
     */
    function registerAsDefaultEditorFor(fileExt) {
        var result = new $.Deferred();
        if (brackets.platform === "win") {
            brackets.app.registerAsDefaultEditorFor(
                fileExt,
                function(err) {
                    if (err !== brackets.app.NO_ERROR) {
                        result.reject(err);
                    } else {
                        result.resolve();
                    }
                }
            );
        } else {
            result.resolve();
        }
        return result.promise();
    }
    
    /**
     * Unregister the app as the default editor for the given file type.
     *
     * @param {string} file extension (eg. ".ext") to unregister
     *
     * @return {$.Promise} a jQuery promise that rejects with an error if unable to unregister
     */
    function unregisterAsDefaultEditorFor(fileExt) {
        var result = new $.Deferred();
        if (brackets.platform === "win") {
            brackets.app.unregisterAsDefaultEditorFor(
                fileExt,
                function(err) {
                    if (err !== brackets.app.NO_ERROR) {
                        result.reject(err);
                    } else {
                        result.resolve();
                    }
                }
            );
        } else {
            result.resolve();
        }
        return result.promise();
    }
    
    /**
     * Conditionally prompts the user to register the app as the default editor for JS and CSS files
     */
    function promptForDefaultEditor() {
        // only prompt on Windows and if we haven't prompted before (ie. first launch)
        if ((brackets.platform === "win")   // Windows-only feature
            && (!_prefs.getValue(PREFS_DEFAULT_EDITOR_PROMPTED))) {
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
            ).done(function (id) {
                if (id === Dialogs.DIALOG_BTN_YES) {
                    // register app as default editor for specific file types
                    registerAsDefaultEditorFor(FILEEXT_JS);
                    registerAsDefaultEditorFor(FILEEXT_CSS);
                } else if (id === Dialogs.DIALOG_BTN_NO) {
                    // unregister app as the default editor for these file types
                    unregisterAsDefaultEditorFor(FILEEXT_JS);
                    unregisterAsDefaultEditorFor(FILEEXT_CSS);
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
    exports.checkIfDefaultEditorFor         = checkIfDefaultEditorFor;
    exports.registerAsDefaultEditorFor      = registerAsDefaultEditorFor;
    exports.unregisterAsDefaultEditorFor    = unregisterAsDefaultEditorFor;
});
