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
/*global define, brackets, $, window, tinycolor, Mustache */

define(function (require, exports, module) {
    "use strict";
    
    var ExtensionLoader         = brackets.getModule("utils/ExtensionLoader"),
        ExtensionUtils          = brackets.getModule("utils/ExtensionUtils"),
        NativeApp               = brackets.getModule("utils/NativeApp"),
        Strings                 = require("strings"),
        kulerAPI                = require("kuler");
    
    var _kulerColorEditorHTML    = require("text!html/KulerColorEditorTemplate.html"),
        _kulerThemeHTML          = require("text!html/KulerThemeTemplate.html");
    
    var kulerColorEditorTemplate    = Mustache.compile(_kulerColorEditorHTML),
        kulerThemeTemplate          = Mustache.compile(_kulerThemeHTML);

    function getConstructor(InlineColorEditor) {
        
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
            
            // If content has no scrollbar, let host editor scroll normally
            if (scroller.clientHeight >= scroller.scrollHeight) {
                return;
            }
            
            // We need to block the event from both the host CodeMirror code (by stopping bubbling) and the
            // browser's native behavior (by preventing default). We preventDefault() *only* when the docs
            // scroller is at its limit (when an ancestor would get scrolled instead); otherwise we'd block
            // normal scrolling of the docs themselves.
            event.stopPropagation();
            if (scrollingUp && scroller.scrollTop === 0) {
                event.preventDefault();
            } else if (!scrollingUp && scroller.scrollTop +
                       scroller.clientHeight >= scroller.scrollHeight) {
                event.preventDefault();
            }
        };
    
        KulerInlineColorEditor.prototype.load = function (hostEditor) {
            KulerInlineColorEditor.prototype.parentClass.load.call(this, hostEditor);
            
            var deferred = $.Deferred(),
                colorEditor = this.colorEditor,
                $htmlContent = this.$htmlContent,
                kuler = kulerColorEditorTemplate(Strings),
                $kuler = $(kuler),
                $themes = $kuler.find(".kuler-themes"),
                $nothemes = $kuler.find(".kuler-no-themes"),
                $loading = $kuler.find(".kuler-loading");

            this.themesPromise.done(function (data) {
                
                if (data.themes.length > 0) {
                    data.themes.forEach(function (theme) {
                        theme.length = theme.swatches.length;

                        var themeHTML = kulerThemeTemplate(theme),
                            $theme = $(themeHTML);
                        
                        $theme.find(".kuler-swatch-block").on("click", function (event) {
                            var $swatch = $(event.target),
                                color = $swatch.data("hex");
                            
                            colorEditor.setColorFromString(color);
                        });
                        
                        $themes.append($theme);
                        
                        kulerAPI.getThemeURLInfo(theme).done(function (info) {
                            var $title = $theme.find(".kuler-swatch-title"),
                                $anchor;
                            
                            if (info.jumpURL) {
                                $title.wrap("<a href='" + info.jumpURL + "'>");
                                $anchor = $title.parent();
                                $anchor.one("click", function (event) {
                                    info.invalidate();
                                    $anchor.one("click", function () {
                                        $anchor.attr("href", info.kulerURL);
                                    });
                                });
                            } else {
                                $title.wrap("<a href='" + info.kulerURL + "'>");
                            }
                        });
                    });
                    $themes.show();
                } else {
                    $nothemes.show();
                }
                
                $loading.hide();
                $kuler.on("click", "a", this._handleLinkClick);
                $kuler.find(".kuler-scroller").on("mousewheel", this._handleWheelScroll);
                $htmlContent.append($kuler);
                deferred.resolve();
            }).fail(function (err) {
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
