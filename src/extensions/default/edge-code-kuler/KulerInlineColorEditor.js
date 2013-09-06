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
            var keys = kulerAPI.orderedCollectionNames,
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
            
            var $menubar = this.$menubar,
                $firstColorItem = colorEditor.$selectionBase,
                $lastKulerItem = this.$lastKulerItem,
                $lastColorItem = this.$lastColorItem;

            $menubar.off(".kuler");
            $lastColorItem.off(".kuler");
            $firstKulerItem.off(".kuler");
            $lastKulerItem.off(".kuler");
            $firstColorItem.off(".kuler");
            
            // tab forward from last focusable color picker element to Kuler menu
            $lastColorItem.on("keydown.kuler", function (event) {
                if (event.keyCode === KeyEvent.DOM_VK_TAB && !event.shiftKey) {
                    $menubar.focus();
                    return false;
                }
            });
            
            // tab backward from Kuler menu to last focusable color picker element
            $menubar.on("keydown.kuler", function (event) {
                if (event.keyCode === KeyEvent.DOM_VK_TAB && event.shiftKey) {
                    $lastColorItem.focus();
                    return false;
                }
            });
            
            // tab forward from Kuler menu to first Kuler swatch
            $menubar.on("keydown.kuler", function (event) {
                if (event.keyCode === KeyEvent.DOM_VK_TAB && !event.shiftKey) {
                    $firstKulerItem.focus();
                    return false;
                }
            });
            
            // tab backward from first Kuler swatch to Kuler menu
            $firstKulerItem.on("keydown.kuler", function (event) {
                if (event.keyCode === KeyEvent.DOM_VK_TAB && event.shiftKey) {
                    $menubar.focus();
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
        
        KulerInlineColorEditor.prototype._toggleKulerMenu = function (event) {
            var cm                  = EditorManager.getCurrentFullEditor()._codeMirror,
                $kuler              = this.$kuler,
                $themes             = this.$themes,
                $nothemes           = this.$nothemes,
                $loading            = this.$loading,
                $title              = this.$title,
                $menubar            = this.$menubar,
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
                cm.off("scroll", closeDropdown);
                $kulerMenuDropdown = null;
                $menubar.focus();
            }
            
            /*
             * Load the collection that corresponds to the selected menu item
             */
            function handleMenuItemSelect(event) {
                var $item = $(event.target).closest("li"),
                    $anchor = $item.children().first(),
                    kulerCollection = $anchor.data("collection");
                
                if (kulerCollection) {
                    var themesPromise = self._getThemes(kulerCollection);
                    
                    $themes.hide();
                    $nothemes.hide();
                    $loading.show();
                    
                    closeDropdown();
                    themesPromise.done(function (data) {
                        self._displayThemes(data, true);
                    });
                }
            }
            
            /*
             * Handle tab and arrow navigation among menu items
             */
            function handleMenuNavigate(event) {
                var $item = $(event.target).closest("li"),
                    $next;
                
                if (event.keyCode === KeyEvent.DOM_VK_DOWN ||
                        (event.keyCode === KeyEvent.DOM_VK_TAB && !event.shiftKey)) {
                    $next = $item.next();
                } else if (event.keyCode === KeyEvent.DOM_VK_UP ||
                        (event.keyCode === KeyEvent.DOM_VK_TAB && event.shiftKey)) {
                    $next = $item.prev();
                }
                
                $next.focus();
            }
            
            /*
             * Handle menu list item events
             */
            function _handleListEvent(event) {
                if (event.type === "click") {
                    handleMenuItemSelect(event);
                    return false;
                } else if (event.type === "keydown") {
                    switch (event.keyCode) {
                    case KeyEvent.DOM_VK_ENTER:
                    case KeyEvent.DOM_VK_RETURN:
                    case KeyEvent.DOM_VK_SPACE:
                        handleMenuItemSelect(event);
                        return false;
                    case KeyEvent.DOM_VK_UP:
                    case KeyEvent.DOM_VK_DOWN:
                    case KeyEvent.DOM_VK_TAB:
                        handleMenuNavigate(event);
                        return false;
                    }
                }
            }

            Menus.closeAll();
            
            // TODO: Can't just use Bootstrap 1.4 dropdowns for this since they're hard-coded to
            // assume that the dropdown is inside a top-level menubar created using <li>s.
            // Have to do this stopProp to avoid the html click handler from firing when this returns.
            event.stopPropagation();
            
            var toggleOffset = this.$menubar.offset(),
                leftOffset = toggleOffset.left - 24,
                toggleDisplay = $("#kuler-dropdown").is(':visible') ? "none" : "inline";
            
            $kulerMenuDropdown
                .css({
                    left: leftOffset,
                    top: toggleOffset.top + this.$menubar.outerHeight(),
                    display: toggleDisplay
                })
                .appendTo($("body"));
            
            $kulerMenuDropdown.children().first().focus();
            
            PopUpManager.addPopUp($kulerMenuDropdown, cleanupDropdown, true);
            
            // TODO: should use capture, otherwise clicking on the menus doesn't close it. More fallout
            // from the fact that we can't use the Boostrap (1.4) dropdowns.
            $("html").on("click", closeDropdown);
            
            // close dropdown when editor scrolls
            cm.on("scroll", closeDropdown);
            
            // Hacky: if we detect a click in the menubar, close ourselves.
            // TODO: again, we should have centralized popup management.
            $("#titlebar .nav").on("click", closeDropdown);
            
            $kulerMenuDropdown.on("click keydown", _handleListEvent);
        };

        /*
         * Handle click and keydown events on the menubar
         */
        KulerInlineColorEditor.prototype._handleMenubarEvent = function (event) {
            if (event.type === "keydown") {
                switch (event.keyCode) {
                case KeyEvent.DOM_VK_ENTER:
                case KeyEvent.DOM_VK_RETURN:
                case KeyEvent.DOM_VK_SPACE:
                    this._toggleKulerMenu(event);
                    return false;
                }
            } else if (event.type === "click") {
                this._toggleKulerMenu(event);
                return false;
            }
        };
        
        KulerInlineColorEditor.prototype.load = function (hostEditor) {
            KulerInlineColorEditor.prototype.parentClass.load.call(this, hostEditor);

            var self            = this,
                deferred        = $.Deferred(),
                colorEditor     = this.colorEditor,
                $htmlContent    = this.$htmlContent,
                kuler           = kulerColorEditorTemplate(Strings),
                $kuler          = $(kuler),
                $menuDropdown   = $(kulerMenuTemplate),
                $themes         = $kuler.find(".kuler-themes"),
                $nothemes       = $kuler.find(".kuler-no-themes"),
                $loading        = $kuler.find(".kuler-loading"),
                $menubar      = $kuler.find(".kuler-collection-title"),
                $title          = $kuler.find(".kuler-dropdown-title"),
                $lastKulerItem  = $kuler.find("a.kuler-more-info"),
                $scroller       = $kuler.find(".kuler-scroller"),
                $firstKulerItem;

            this.$kuler = $kuler;
            this.$themes = $themes;
            this.$nothemes = $nothemes;
            this.$loading = $loading;
            this.$title = $title;
            this.$menubar = $menubar;
            this.$kulerMenuDropdown = $menuDropdown;
            this.$lastKulerItem = $lastKulerItem;
            this.$scroller = $scroller;
            
            $loading.show();

            $kuler.on("click", "a", this._handleLinkClick);
            $scroller.on("mousewheel", this._handleWheelScroll.bind(this));
            $menubar.on("click keydown", this._handleMenubarEvent.bind(this));
            
            this.$htmlContent.append($kuler);
            
            // get the last collection of themes displayed in the Kuler panel (or default to My Themes)
            var lastDisplayedCollection = kulerAPI.getLastDisplayedCollection(),
                collectionName = lastDisplayedCollection || kulerAPI.orderedCollectionNames[0],
                themesPromise = self._getThemes(collectionName);

            themesPromise.done(function (data) {
                self._displayThemes(data, false);
                deferred.resolve();
            }).fail(function (err) {
                deferred.reject(err);
            });
            
            return deferred.promise();
        };

        /**
         * Called once content is parented in the host editor's DOM.
         */
        KulerInlineColorEditor.prototype.onAdded = function () {
            KulerInlineColorEditor.prototype.parentClass.onAdded.apply(this, arguments);

            var LEFT_MARGIN = 15;
            
            var self = this,
                displayThemes = this._displayThemes.bind(this),
                $kuler = this.$kuler,
                $scroller = this.$scroller,
                $colorEditor = this.colorEditor.$element,
                $list = $colorEditor.children().last(),
                kulerOffset = {
                    left: $list.offset().left + $list.outerWidth() + LEFT_MARGIN
                };
            
            $kuler.offset(kulerOffset);
            
            // refresh the open collection of themes when the themes are updated
            $(kulerAPI).on("themesUpdated", function (event, collectionName, themes) {
                if (collectionName === self.activeCollection &&
                        collectionName !== kulerAPI.COLLECTION_RANDOM) {
                    
                    var $focusedElement = $kuler.find(":focus"),
                        scrollY         = $scroller.scrollTop();
                    
                    displayThemes(themes, false);
                    
                    // restore focus to the previously focused element
                    var id = $focusedElement.attr("id"),
                        selector = "#" + id,
                        $newElement = $kuler.find(selector);
                    
                    if ($newElement.length === 1) {
                        $newElement.attr("tabindex", 0);
                        $newElement.focus();
                        $scroller.scrollTop(scrollY);
                    }
                }
            });
        };
        
        /**
         * Called any time inline editor is closed, whether manually or automatically.
         */
        KulerInlineColorEditor.prototype.onClosed = function () {
            KulerInlineColorEditor.prototype.parentClass.onAdded.apply(this, arguments);
            
            $(kulerAPI).off("themesUpdated");
        };
        
        return KulerInlineColorEditor;
    }

    exports.getConstructor = getConstructor;
});
