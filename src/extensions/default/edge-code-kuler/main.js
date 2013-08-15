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
/*global define, brackets, $, Mustache, window, tinycolor */

define(function (require, exports, module) {
    "use strict";

    var AppInit                 = brackets.getModule("utils/AppInit"),
        ExtensionLoader         = brackets.getModule("utils/ExtensionLoader"),
        ExtensionUtils          = brackets.getModule("utils/ExtensionUtils"),
        EditorManager           = brackets.getModule("editor/EditorManager"),
        Strings                 = brackets.getModule("strings"),
        NativeApp               = brackets.getModule("utils/NativeApp"),
        KulerInlineEditorModule = require("KulerInlineColorEditor"),
        KulerAPI                = require("kuler");

    function setup(prepareEditorForProvider, InlineColorEditor) {
        EditorManager.registerInlineEditProvider(function (hostEditor, pos) {
            // Do nothing if there is no authentication provider
            if (!brackets.authentication) {
                return null;
            }
            
            // Do nothing if the the cursor is not in a color token
            var context = prepareEditorForProvider(hostEditor, pos);
            if (!context) {
                return null;
            }
            
            // Do nothing if we don't have an Internet connection.  Otherwise, calls to Kuler will fail anyway.
            if (!window.navigator.onLine) {
                return null;
            }
            
            var KulerInlineEditor = KulerInlineEditorModule.getConstructor(InlineColorEditor, tinycolor),
                kulerEditor = new KulerInlineEditor(context.color, context.start, context.end),
                kulerDeferred = $.Deferred(),
                inlineEditorDeferred = $.Deferred();
            
            brackets.authentication.getAuthorizedUser().done(function (user) {
                kulerEditor.load(hostEditor).done(function () {
                    kulerDeferred.resolve();
                }).fail(function (err) {
                    kulerDeferred.reject(err);
                });
            }).fail(function (err) {
                kulerDeferred.reject(err);
            });
            
            kulerDeferred.done(function () {
                inlineEditorDeferred.resolve(kulerEditor);
            }).fail(function (err) {
                console.warn("Unable to load Kuler editor", err);
                
                // EditorManager ought to pick another provider when the promise
                // rejects, but instead it just fails silently. As a workaround,
                // we instead return our own instance of InlineColorEditor. 
                var colorEditor = new InlineColorEditor(context.color, context.start, context.end);
                colorEditor.load(hostEditor);
                inlineEditorDeferred.resolve(colorEditor);
            });

            return inlineEditorDeferred.promise();
        }, 1);
    }

    AppInit.appReady(function () {
        var r = ExtensionLoader.getRequireContextForExtension("InlineColorEditor"),
            mainModule = r("main"),
            InlineColorEditorModule = r("InlineColorEditor");

        // load the tinycolor module from the InlineColorEditor extension
        r("thirdparty/tinycolor-min");

        ExtensionUtils.loadStyleSheet(module, "styles/kuler.less");

        setup(mainModule.prepareEditorForProvider, InlineColorEditorModule.InlineColorEditor);
        
        // warm up the cache
        KulerAPI.getMyThemes();
        KulerAPI.getFavoriteThemes();
        KulerAPI.getRandomThemes();
        KulerAPI.getPopularThemes();
        
        // refresh cache whenever focus returns to the window
        window.addEventListener("focus", function () {
            KulerAPI.getMyThemes(true); // force refresh
            KulerAPI.getFavoriteThemes(true);
            KulerAPI.getPopularThemes(true);
            KulerAPI.getRandomThemes(true);
        });
    });
});
