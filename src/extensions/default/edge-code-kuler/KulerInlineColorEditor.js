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

/*jslint vars: true, plusplus: true, nomen: true, regexp: true, maxerr: 50 */
/*global define, brackets, $, window, Mustache, tinycolor */

define(function (require, exports, module) {
    "use strict";
    
    var EditorManager           = brackets.getModule("editor/EditorManager"),
        ExtensionLoader         = brackets.getModule("utils/ExtensionLoader"),
        ExtensionUtils          = brackets.getModule("utils/ExtensionUtils"),
        Menus                   = brackets.getModule("command/Menus"),
        KeyEvent                = brackets.getModule("utils/KeyEvent"),
        NativeApp               = brackets.getModule("utils/NativeApp"),
        PopUpManager            = brackets.getModule("widgets/PopUpManager"),
        Strings                 = require("strings"),
        kulerAPI                = require("kuler");
        
    var _kulerColorEditorHTML   = require("text!html/KulerColorEditorTemplate.html"),
        _kulerThemeHTML         = require("text!html/KulerThemeTemplate.html"),
        _kulerMenuHTML          = require("text!html/KulerMenu.html");
    
    var kulerColorEditorTemplate    = Mustache.compile(_kulerColorEditorHTML),
        kulerThemeTemplate          = Mustache.compile(_kulerThemeHTML),
        kulerMenuTemplate           = Mustache.render(_kulerMenuHTML, Strings);
    
    var tinycolor,
        FAVORITE_THEMES = "FAVORITE_KULER_THEMES",
        POPULAR_THEMES = "POPULAR_KULER_THEMES",
        RANDOM_THEMES = "RANDOM_KULER_THEMES",
        MY_THEMES = "MY_KULER_THEMES";
    
    function getConstructor(InlineColorEditor, _tinycolor) {
        
        tinycolor = _tinycolor;

        /**
         * @contructor
         */
        function KulerInlineColorEditor() {
            InlineColorEditor.apply(this, arguments);
            this.themesPromise = kulerAPI.getMyThemes();
        }
        
        KulerInlineColorEditor.prototype = Object.create(InlineColorEditor.prototype);
        KulerInlineColorEditor.prototype.constructor = KulerInlineColorEditor;
        KulerInlineColorEditor.prototype.parentClass = InlineColorEditor.prototype;
        
        KulerInlineColorEditor.prototype._handleLinkClick = function (event) {
            event.preventDefault();
            var url = $(event.currentTarget).attr("href");
            if (url) {
                NativeApp.openURLInDefaultBrowser(url);
            }
        };
        
        KulerInlineColorEditor.prototype._handleWheelScroll = function (event) {
            var scrollingUp = (event.originalEvent.wheelDeltaY > 0),
                scroller = event.currentTarget;
            
            if (this.$kulerMenuDropdown.is(':visible')) {
                PopUpManager.removePopUp(this.$kulerMenuDropdown);
            }
            
            // If content has no scrollbar, let host editor scroll normally
            if (scroller.clientHeight >= scroller.scrollHeight) {
                return;
            }
            
            // We need to block the event from both the host CodeMirror code (by stopping bubbling) and the
            // browser's native behavior (by preventing default). We preventDefault() *only* when the Kuler
            // scroller is at its limit (when an ancestor would get scrolled instead); otherwise we'd block
            // normal scrolling of the Kuler themes themselves.
            event.stopPropagation();
            if (scrollingUp && scroller.scrollTop === 0) {
                event.preventDefault();
            } else if (!scrollingUp && scroller.scrollTop +
                       scroller.clientHeight >= scroller.scrollHeight) {
                event.preventDefault();
            }
        };
        /**
         * build the color swatch matrix and attach event handlers
         * @return {boolean} - returns false if there are no swatches, true otherwise              
         */
        KulerInlineColorEditor.prototype._handleThemesPromise = function (data) {
            var $themes = this.$themes,
                $nothemes = this.$nothemes,
                $loading = this.$loading,
                $title = this.$title,
                colorEditor = this.colorEditor,
                returnVal = false;
            
            $themes.empty();
            if (data.themes.length > 0) {
                data.themes.forEach(function (theme) {
                    theme.swatches.forEach(function (swatch) {
                        var color = tinycolor(swatch.hex);
                        swatch.hex = color.toHexString();
                        swatch.rgb = color.toRgbString();
                        swatch.hsl = color.toHslString();
                    });
                    
                    function handleSwatchAction(event) {
                        if (event.type !== "keydown" ||
                                event.keyCode === KeyEvent.DOM_VK_ENTER ||
                                event.keyCode === KeyEvent.DOM_VK_RETURN) {
                            var $selected = colorEditor.$buttonList.find(".selected"),
                                $swatch = $(event.target),
                                colorString;
                            
                            if ($selected.find(".rgba").length) {
                                colorString = $swatch.data("rgb");
                            } else if ($selected.find(".hsla").length) {
                                colorString = $swatch.data("hsl");
                            } else {
                                colorString = $swatch.data("hex");
                            }
                            
                            colorEditor.setColorFromString(colorString);
                        }
                    }
                    
                    theme.length = theme.swatches.length;
                    
                    var themeHTML = kulerThemeTemplate(theme),
                        $theme = $(themeHTML);
                    
                    $theme.find(".kuler-swatch-block").on("keydown click", handleSwatchAction);
                    
                    $themes.append($theme);
                    
                    kulerAPI.getThemeURLInfo(theme).done(function (getUrl) {
                        var $title = $theme.find(".kuler-swatch-title"),
                            $anchor;
                        
                        $title.wrap("<a href='#'>");
                        $anchor = $title.parent();
                        $anchor.on("click", function () {
                            NativeApp.openURLInDefaultBrowser(getUrl());
                            return false;
                        });
                        $anchor.attr("tabindex", -1);
                    });
                });
                returnVal = true;
                $themes.show();
            } else {
                returnVal = false;
                $nothemes.show();
            }

            $loading.hide();
            return returnVal;
        };
        
        KulerInlineColorEditor.prototype._toggleKulerMenu = function (codemirror, e) {
            var $kuler              = this.$kuler,
                $themes             = this.$themes,
                $loading            = this.$loading,
                $title              = this.$title,
                colorEditor         = this.colorEditor,
                $kulerMenuDropdown  = this.$kulerMenuDropdown,
                self                = this;

            /**
             * Fetch My Themes and update UI
             * @return {promise} - a promise that resolves when the themes have been fetched 
             */
            function getThemes($kuler, collectionName) {
                $title.text(Strings[collectionName]);
                var newWidth = $title.width() + $kuler.find(".kuler-dropdown-arrow").width() + 8;
                $kuler.find(".kuler-collection-title").css("width", newWidth);
                switch (collectionName) {
                case MY_THEMES:
                    return kulerAPI.getMyThemes();
                case FAVORITE_THEMES:
                    return kulerAPI.getFavoriteThemes();
                case POPULAR_THEMES:
                    return kulerAPI.getPopularThemes();
                case RANDOM_THEMES:
                    return kulerAPI.getRandomThemes();
                default:
                    throw new Error("Unknown Kuler theme collection: " + collectionName);
                }
            }
            
            /**
             * Close the dropdown.
             */
            function closeDropdown() {
                // Since we passed "true" for autoRemove to addPopUp(), this will
                // automatically remove the dropdown from the DOM. Also, PopUpManager
                // will call cleanupDropdown().
                if ($kulerMenuDropdown) {
                    PopUpManager.removePopUp($kulerMenuDropdown);
                }
            }
            
            /**
             * Remove the various event handlers that close the dropdown. This is called by the
             * PopUpManager when the dropdown is closed.
             */
            function cleanupDropdown() {
                $("html").off("click", closeDropdown);
                $("#titlebar .nav").off("click", closeDropdown);
                codemirror.off("scroll", closeDropdown);
                $kulerMenuDropdown = null;
            }
            /**
             * Adds the click and mouse enter/leave events to the dropdown
             */
            function _handleListEvents() {
                $kulerMenuDropdown.click(function (e) {
                    var $link = $(e.target).closest("a"),
                        kulerCollection  = $link.data("collection"),
                        newWidth;
                    
                    if (kulerCollection) {
                        $themes.hide();
                        $loading.show();
                        this.themesPromise = getThemes($kuler, kulerCollection);
                        var boundThemesHandler = KulerInlineColorEditor.prototype._handleThemesPromise.bind(self);
                        
                        this.themesPromise.done(function (data) {
                            if (boundThemesHandler(data)) {
                                self.$firstKulerItem = $themes.find(".kuler-swatch-block").first();
                            } else {
                                self.$firstKulerItem = self.$lastKulerItem;
                            }
                    
                        });
                        closeDropdown();
                    }
                    
                });
            }

            Menus.closeAll();
            
            // TODO: Can't just use Bootstrap 1.4 dropdowns for this since they're hard-coded to
            // assume that the dropdown is inside a top-level menubar created using <li>s.
            // Have to do this stopProp to avoid the html click handler from firing when this returns.
            e.stopPropagation();
            
            var toggleOffset = this.$kulerMenuDropdownToggle.offset(),
                leftOffset = toggleOffset.left - 24,
                toggleDisplay = $("#kuler-dropdown").is(':visible') ? "none" : "inline";
            
            $kulerMenuDropdown
                .css({
                    left: leftOffset,
                    top: toggleOffset.top + this.$kulerMenuDropdownToggle.outerHeight(),
                    display: toggleDisplay
                })
                .appendTo($("body"));
            
            PopUpManager.addPopUp($kulerMenuDropdown, cleanupDropdown, true);
            
            // TODO: should use capture, otherwise clicking on the menus doesn't close it. More fallout
            // from the fact that we can't use the Boostrap (1.4) dropdowns.
            $("html").on("click", closeDropdown);
            
            // close dropdown when editor scrolls
            codemirror.on("scroll", closeDropdown);
            
            // Hacky: if we detect a click in the menubar, close ourselves.
            // TODO: again, we should have centralized popup management.
            $("#titlebar .nav").on("click", closeDropdown);
            
            _handleListEvents();
        };

        
        KulerInlineColorEditor.prototype.load = function (hostEditor) {
            KulerInlineColorEditor.prototype.parentClass.load.call(this, hostEditor);
            
            var self = this,
                deferred        = $.Deferred(),
                colorEditor     = this.colorEditor,
                $htmlContent    = this.$htmlContent,
                kuler           = kulerColorEditorTemplate(Strings),
                $kuler          = $(kuler),
                $themes         = $kuler.find(".kuler-themes"),
                $nothemes       = $kuler.find(".kuler-no-themes"),
                $loading        = $kuler.find(".kuler-loading"),
                $title          = $kuler.find(".kuler-dropdown-title"),
                $lastKulerItem  = $kuler.find("a.kuler-more-info"),
                $lastColorPickerItem;

            this.$kuler = $kuler;
            this.$themes = $themes;
            this.$nothemes = $nothemes;
            this.$loading = $loading;
            this.$title = $title;
            this.$kulerMenuDropdown = $(kulerMenuTemplate);
            this.$lastKulerItem = $lastKulerItem;
            this.themesPromise
                .done(function (data) {
                    if (self._handleThemesPromise(data)) {
                        self.$firstKulerItem = $themes.find(".kuler-swatch-block").first();
                    } else {
                        self.$firstKulerItem = self.$lastKulerItem;
                    }
                    
                    var $swatchItems = colorEditor.$swatches.find("li");
                    if ($swatchItems.length > 0) {
                        // override tab behavior of last color editor swatch, if it exists
                        $lastColorPickerItem = $swatchItems.last();
                    } else {
                        // otherwise override the HSL button
                        $lastColorPickerItem = colorEditor.$hslButton;
                    }
                    
                    // tab forward from last focusable color picker element to first Kuler swatch
                    $lastColorPickerItem.on("keydown", function (event) {
                        if (event.keyCode === KeyEvent.DOM_VK_TAB && !event.shiftKey) {
                            self.$firstKulerItem.focus();
                            return false;
                        }
                    });
                    
                    // tab backward from first Kuler swatch to last focusable color picker element
                    self.$firstKulerItem.on("keydown", function (event) {
                        if (event.keyCode === KeyEvent.DOM_VK_TAB && event.shiftKey) {
                            $lastColorPickerItem.focus();
                            return false;
                        }
                    });
                    
                    // tab forward from more info tab to first focusable color picker element
                    self.$lastKulerItem.on("keydown", function (event) {
                        if (event.keyCode === KeyEvent.DOM_VK_TAB && !event.shiftKey) {
                            colorEditor.$selectionBase.focus();
                            return false;
                        }
                    });
                    
                    // tab backward from first focusable color picker to element more info tab
                    colorEditor.$selectionBase.on("keydown", function (event) {
                        if (event.keyCode === KeyEvent.DOM_VK_TAB && event.shiftKey) {
                            self.$lastKulerItem.focus();
                            return false;
                        }
                    });
                                            
                    $kuler.on("click", "a", self._handleLinkClick);
                    $kuler.find(".kuler-scroller").on("mousewheel", self._handleWheelScroll.bind(self));
                    self.$kulerMenuDropdownToggle = $kuler.find("#kuler-dropdown-toggle")
                        .click(self._toggleKulerMenu.bind(self, EditorManager.getCurrentFullEditor()._codeMirror));
        
                    self.$htmlContent.append($kuler);
                    deferred.resolve();
                })
                .fail(function (err) {
                    deferred.reject(err);
                });
            

            return deferred.promise();
        };

        
        KulerInlineColorEditor.prototype.onAdded = function () {
            KulerInlineColorEditor.prototype.parentClass.onAdded.apply(this, arguments);
            
            var LEFT_MARGIN = 15;
            var $colorEditor = this.$htmlContent.find(".color-editor"),
                $kuler = this.$htmlContent.find(".kuler"),
                children = $colorEditor.children(),
                $list = $(children[1]),
                kulerOffset = {
                    top: $kuler.offset().top,
                    left: $list.offset().left + $list.outerWidth() + LEFT_MARGIN
                };
            
            $kuler.offset(kulerOffset);
        };
        
        return KulerInlineColorEditor;
    }

    exports.getConstructor = getConstructor;
});
