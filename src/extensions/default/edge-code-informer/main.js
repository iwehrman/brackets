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


/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, Mustache */

define(function (require, exports, module) {
    "use strict";
    
    var AppInit         = brackets.getModule("utils/AppInit"),
        KeyEvent        = brackets.getModule("utils/KeyEvent"),
        ExtensionUtils  = brackets.getModule("utils/ExtensionUtils");
    
    var informer        = require("informer"),
        Strings         = require("strings"),
        toolbarHTML     = require("text!html/toolbar.html"),
        popoverTemplate = require("text!html/popover.html");
    
    var ANIMATION_DURATION          = 75,
        THANKS_DURATION             = 2000,
        POPOVER_OFFSET_MAGIC_NUMBER = 190,
        SHOW_POPOVER_CLASS          = "edge-code-informer-show",
        DISABLE_TOOLBAR_CLASS       = "edge-code-informer-disabled";

    var popoverHTML     = Mustache.render(popoverTemplate, Strings),
        $toolbarIcon    = $(toolbarHTML),
        $popover        = $(popoverHTML),
        $textarea       = $popover.find("textarea"),
        $submit         = $popover.find("input"),
        $thanks         = $popover.find(".edge-code-informer-thanks"),
        $legal          = $popover.find(".edge-code-informer-legal"),
        $body           = $("body"),
        thanksTimer     = null;
        
    /*
     * Hide the thank you message and show the textarea in the open popover.
     */
    function hideThanks() {
        $submit.show();
        $textarea.show();
        $legal.show();
        $thanks.hide();
    }
    
    /*
     * Hide the popover and remove the outside body event handlers.
     */
    function hidePopover() {
        $popover.removeClass(SHOW_POPOVER_CLASS);
        $body.off(".informer");
        setTimeout(hideThanks, 500);
        if (thanksTimer) {
            window.clearTimeout(thanksTimer);
            thanksTimer = null;
        }
    }

    /*
     * Show the thank-you message and hide the textarea in the open popover.
     */
    function showThanks() {
        $submit.hide();
        $textarea.hide();
        $legal.hide();
        $thanks.show();
        thanksTimer = window.setTimeout(hidePopover, THANKS_DURATION);
    }
    
    /*
     * Show the popover, focus the textarea, and setup event handlers on the
     * body to dismiss the dialog upon input elsewhere.
     */
    function showPopover() {
        var toobarIconOffset = $toolbarIcon.offset(),
            popoverTop = toobarIconOffset.top - POPOVER_OFFSET_MAGIC_NUMBER;

        // Dynamically position the popover according to the height of the toolbar icon        
        $popover
            .css("top", popoverTop)
            .addClass(SHOW_POPOVER_CLASS);
        
        $textarea.focus();
        
        // Dismiss the popover on click or keydown events that aren't on the
        // popover or the toolbar icon.
        $body.on("click.informer keydown.informer", function (event) {
            var $target = $(event.target);
            if ($popover.find($target).length === 0 && $target !== $toolbarIcon) {
                hidePopover();
            }
        });
    }
    
    /*
     * Toggle the popover: show it if it's currently hidden, and hide it if
     * it's currently shown.
     */
    function togglePopover() {
        if ($popover.hasClass(SHOW_POPOVER_CLASS)) {
            hidePopover();
        } else {
            showPopover();
        }
        return false;
    }

    /*
     * Handle the feedback submission by posting to the Informer service,
     * showing a thank-you message, and then dismissing the popup.
     */
    function handleSubmit(event) {
        var feedbackText = $textarea.val();
        
        informer.postFeedback(feedbackText);
        showThanks();
        $textarea.val("");
    }
    
    var handleOnline;
    
    /*
     * Disable the informer extension
     */
    function disableInformer() {
        $toolbarIcon
            .addClass(DISABLE_TOOLBAR_CLASS)
            .removeAttr("title")
            .off("click");
        
        if (!window.navigator.onLine) {
            window.addEventListener("online", handleOnline);
        }
    }

    /*
     * Enable the informer extension
     */
    function enableInformer() {
        $toolbarIcon
            .removeClass(DISABLE_TOOLBAR_CLASS)
            .attr("title", Strings.INFORMER_TOOLTIP)
            .on("click", togglePopover);
        
        window.addEventListener("offline", disableInformer);
    }
    
    /*
     * When we go back online, enable the extension if the Informer service is online
     */
    handleOnline = function () {
        window.removeEventListener("online", handleOnline);
        informer.getStatus().then(enableInformer, disableInformer);
    };
    
    AppInit.appReady(function () {
        ExtensionUtils.loadStyleSheet(module, "styles/informer.css");
        
        // Append the popover and handle the escape key
        $popover
            .appendTo("body")
            .on("keydown", function (event) {
                if (event.keyCode === KeyEvent.DOM_VK_ESCAPE) {
                    hidePopover();
                    return false;
                }
            });
        
        // Enable the submission button when the textarea is nonempty
        $textarea
            .on("keyup paste", function (event) {
                if ($textarea.val().length) {
                    $submit.removeAttr("disabled");
                } else {
                    $submit.attr("disabled", "disabled");
                }
            })
            .on("keydown", function (event) {
                if (event.keyCode === KeyEvent.DOM_VK_TAB &&
                        $submit.attr("disabled") === "disabled") {
                    return false;
                }
            });
        
        // Handle submission and tabbing
        $submit
            .on("click keydown", function (event) {
                if (event.type === "keydown") {
                    if (event.keyCode === KeyEvent.DOM_VK_TAB) {
                        $textarea.focus();
                        return false;
                    } else if (event.keyCode === KeyEvent.DOM_VK_RETURN ||
                                 event.keyCode === KeyEvent.DOM_VK_ENTER ||
                                 event.keyCode === KeyEvent.DOM_VK_SPACE) {
                        handleSubmit();
                        return false;
                    }
                } else { // event.type === "click"
                    handleSubmit();
                    return false;
                }
            });
        
        // Add the toolbar icon to the toolbar
        $toolbarIcon
            .appendTo("#main-toolbar > .bottom-buttons");
        
        // Enable the extension if the Informer service is currently online
        informer.getStatus().then(enableInformer, disableInformer);
    });
});
