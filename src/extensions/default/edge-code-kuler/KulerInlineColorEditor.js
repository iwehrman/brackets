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

/*jslint vars: true, plusplus: true, nomen: true, regexp: true, maxerr: 50, browser: true */
/*global define, brackets, $, Mustache, tinycolor */

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
        kulerAPI                = require("kuler"),
        tinycolor;
    
    var _kulerColorEditorHTML   = require("text!html/KulerColorEditorTemplate.html"),
        _kulerThemeHTML         = require("text!html/KulerThemeTemplate.html"),
        _kulerMenuHTML          = require("text!html/KulerMenu.html");
    
    var kulerColorEditorTemplate    = Mustache.compile(_kulerColorEditorHTML),
        kulerThemeTemplate          = Mustache.compile(_kulerThemeHTML),
        kulerMenuTemplate           = (function () {
            var keys = kulerAPI.collectionNames,
                collections = keys.map(function (key) {
                    return {
                        key: key,
                        title: Strings[key]
                    };
                }),
                settings = {
                    collections: collections
                };
            
            return Mustache.render(_kulerMenuHTML, settings);
        }());
    
    // used to generate unique IDs for multiple instances of the inline editor
    var instanceCounter = 0;

    function getConstructor(InlineColorEditor, _tinycolor) {
        
        tinycolor = _tinycolor;

        /**
         * @constructor
         */
        function KulerInlineColorEditor() {
            InlineColorEditor.apply(this, arguments);
            this.idPrefix = "kuler-" + instanceCounter++;
        }
        
        KulerInlineColorEditor.prototype = Object.create(InlineColorEditor.prototype);
        KulerInlineColorEditor.prototype.constructor = KulerInlineColorEditor;
        KulerInlineColorEditor.prototype.parentClass = InlineColorEditor.prototype;

        /**
         * Fetch My Themes and update UI
         * @param {string} collectionName Name of Kuler collection to display
         * @return {Promise.<collection>} - 
         *      a promise that resolves when the requested themes collection has been fetched from Kuler
         */
        KulerInlineColorEditor.prototype._getThemes = function (collectionName) {
            this.activeCollection = collectionName;
            this.$title.text(Strings[collectionName]);
            
            // remember this collection as the last displayed
            kulerAPI.setLastDisplayedCollection(collectionName);
            
            return kulerAPI.getThemes(collectionName);
        };
        
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
         * Adds keydown handlers for elements in the color picker and the Kuler
         * themes list. Grafts the first and last focusable Kuler elements into
         * the tabbing cycle of the color picker. This connects the last focusable
         * color picker element to the first focusable Kuler element, and the last
         * focusable Kuler element to the first focusable color picker when tabbing
         * forward. In the other direction, this connects first focusable color picker
         * element to the last focusable Kuler element, and the first focusable Kuler
         * element to the last focusable color picker element.
         * 
         * Assumes that this.$lastKulerItem and this.$lastColorItem, which are static,
         * have already been initialized.
         *
         * @param {jQuery.Object} $firstKulerItem - the first focusable Kuler element
         */
        KulerInlineColorEditor.prototype._addKeydownHandlers = function ($firstKulerItem) {
            var colorEditor = this.colorEditor;
            if (!this.$lastColorItem) {
                var $swatchItems = colorEditor.$swatches.find("li");
                if ($swatchItems.length > 0) {
                    // override tab behavior of last color editor swatch, if it exists
                    this.$lastColorItem = $swatchItems.last();
                } else {
                    // otherwise override the HSL button
                    this.$lastColorItem = colorEditor.$hslButton;
                }
            }
            
            var $firstColorItem = colorEditor.$selectionBase,
                $lastKulerItem = this.$lastKulerItem,
                $lastColorItem = this.$lastColorItem;

            $lastColorItem.off(".kuler");
            $firstKulerItem.off(".kuler");
            $lastKulerItem.off(".kuler");
            $firstColorItem.off(".kuler");
            
            // tab forward from last focusable color picker element to first Kuler swatch
            $lastColorItem.on("keydown.kuler", function (event) {
                if (event.keyCode === KeyEvent.DOM_VK_TAB && !event.shiftKey) {
                    $firstKulerItem.focus();
                    return false;
                }
            });
            
            // tab backward from first Kuler swatch to last focusable color picker element
            $firstKulerItem.on("keydown.kuler", function (event) {
                if (event.keyCode === KeyEvent.DOM_VK_TAB && event.shiftKey) {
                    $lastColorItem.focus();
                    return false;
                }
            });
            
            // tab forward from more info tab to first focusable color picker element
            $lastKulerItem.on("keydown.kuler", function (event) {
                if (event.keyCode === KeyEvent.DOM_VK_TAB && !event.shiftKey) {
                    $firstColorItem.focus();
                    return false;
                }
            });
            
            // tab backward from first focusable color picker to element more info tab
            $firstColorItem.on("keydown.kuler", function (event) {
                if (event.keyCode === KeyEvent.DOM_VK_TAB && event.shiftKey) {
                    $lastKulerItem.focus();
                    return false;
                }
            });
        };

        /**
         * build the color swatch matrix and attach event handlers
         *
         * @param {Collection} data - Kuler theme collection object
         * @param {boolean} focusFirstElem - Whether to give focus to the first Kuler element
         */
        KulerInlineColorEditor.prototype._displayThemes = function (data, focusFirstElem) {
            var $themes = this.$themes,
                $nothemes = this.$nothemes,
                $loading = this.$loading,
                $title = this.$title,
                colorEditor = this.colorEditor,
                idPrefix = this.idPrefix,
                $firstKulerItem;
            
            $themes.empty();
            if (data.themes.length > 0) {
                data.themes.forEach(function (theme) {
                    theme.swatches.forEach(function (swatch, index) {
                        var color = tinycolor(swatch.hex),
                            id = [idPrefix, theme.id, index].join("-");
                            
                        swatch.hex = color.toHexString();
                        swatch.rgb = color.toRgbString();
                        swatch.hsl = color.toHslString();
                        swatch.id = id;
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
                    
                    theme.titleId = [idPrefix, theme.id].join("-");
                    theme.length = theme.swatches.length;
                    
                    var themeHTML = kulerThemeTemplate(theme),
                        $theme = $(themeHTML);
                    
                    $theme.find(".kuler-swatch-block").on("keydown click", handleSwatchAction);
                    
                    $themes.append($theme);
                    
                    kulerAPI.getThemeURLInfo(theme).done(function (getUrl) {
                        var $title = $theme.find(".kuler-swatch-title"),
                            $anchor = $title.parent();

                        $anchor.attr("tabindex", 0);
                        $anchor.attr("href", "#");
                        $anchor.on("click", function () {
                            NativeApp.openURLInDefaultBrowser(getUrl());
                            return false;
                        });
                    });
                });
                
                $firstKulerItem = $themes.find(".kuler-swatch-block").first();
                $themes.show();
            } else {
                $firstKulerItem = this.$lastKulerItem;
                $nothemes.show();
            }
            
            if (focusFirstElem) {
                $firstKulerItem.focus();
            }
            
            this._addKeydownHandlers($firstKulerItem);
            $loading.hide();
        };
        
        KulerInlineColorEditor.prototype._toggleKulerMenu = function (codemirror, e) {
            var $kuler              = this.$kuler,
                $themes             = this.$themes,
                $nothemes           = this.$nothemes,
                $loading            = this.$loading,
                $title              = this.$title,
                colorEditor         = this.colorEditor,
                $kulerMenuDropdown  = this.$kulerMenuDropdown,
                self                = this;
            
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
                        kulerCollection = $link.data("collection"),
                        newWidth;
                    
                    if (kulerCollection) {
                        var themesPromise = self._getThemes(kulerCollection);
                        
                        $themes.hide();
                        $nothemes.hide();
                        $loading.show();
                        
                        themesPromise.done(function (data) {
                            self._displayThemes(data, true);
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

            var self            = this,
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
                $firstKulerItem;

            this.$kuler = $kuler;
            this.$themes = $themes;
            this.$nothemes = $nothemes;
            this.$loading = $loading;
            this.$title = $title;
            this.$kulerMenuDropdown = $(kulerMenuTemplate);
            this.$lastKulerItem = $lastKulerItem;
            
            $loading.show();

            $kuler.on("click", "a", self._handleLinkClick);
            $kuler.find(".kuler-scroller").on("mousewheel", self._handleWheelScroll.bind(self));
            this.$kulerMenuDropdownToggle = $kuler.find(".kuler-collection-title")
                .click(self._toggleKulerMenu.bind(self, EditorManager.getCurrentFullEditor()._codeMirror));
            this.$htmlContent.append($kuler);
            
            // get the last collection of themes displayed in the Kuler panel (or default to My Themes)
            var lastDisplayedCollection = kulerAPI.getLastDisplayedCollection(),
                collectionName = lastDisplayedCollection || kulerAPI.collectionNames[0],
                themesPromise = self._getThemes(collectionName);

            themesPromise.done(function (data) {
                self._displayThemes(data, false);
                deferred.resolve();
            }).fail(function (err) {
                deferred.reject(err);
            });
            
            return deferred.promise();
        };

        
        KulerInlineColorEditor.prototype.onAdded = function () {
            KulerInlineColorEditor.prototype.parentClass.onAdded.apply(this, arguments);

            var LEFT_MARGIN = 15;
            
            var self = this,
                $colorEditor = this.$htmlContent.find(".color-editor"),
                $kuler = this.$htmlContent.find(".kuler"),
                children = $colorEditor.children(),
                $list = $(children[1]),
                kulerOffset = {
                    left: $list.offset().left + $list.outerWidth() + LEFT_MARGIN
                };
            
            $kuler.offset(kulerOffset);
            
            // refresh the open collection of themes when the themes are updated
            $(kulerAPI).on("themesUpdated", function (event, collectionName, themes) {
                if (collectionName === self.activeCollection &&
                        collectionName !== "RANDOM_KULER_THEMES") {
                    
                    var $focusedElement = self.$kuler.find(":focus");
                    
                    self._displayThemes(themes, false);
                    
                    // restore focus to the previously focused element
                    var id = $focusedElement.attr("id"),
                        selector = "#" + id,
                        $newElement = self.$kuler.find(selector);
                    
                    if ($newElement.length === 1) {
                        $newElement.attr("tabindex", 0);
                        $newElement.focus();
                    }
                }
            });
        };
        
        
        KulerInlineColorEditor.prototype.onClosed = function () {
            KulerInlineColorEditor.prototype.parentClass.onAdded.apply(this, arguments);
            
            $(kulerAPI).off("themesUpdated");
        };
        
        return KulerInlineColorEditor;
    }

    exports.getConstructor = getConstructor;
});
