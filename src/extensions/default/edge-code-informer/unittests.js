/*
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
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

/*jslint vars: true, plusplus: true, devel: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, describe, it, xit, expect, beforeEach, beforeFirst, afterEach, afterLast, waitsFor, runs, $, brackets, waitsForDone, waitsForFail, waits, spyOn */

define(function (require, exports, module) {
    "use strict";

    var SpecRunnerUtils = brackets.getModule("spec/SpecRunnerUtils"),
        main = require('main'),
        informer;

    describe("Informer", function () {

        var testWindow,
            brackets,
            jquery,
            extensionRequire;

        beforeFirst(function () {
            runs(function () {
                SpecRunnerUtils.createTestWindowAndRun(this, function (w) {
                    testWindow = w;
                    // Load module instances from brackets.test
                    brackets = testWindow.brackets;
                    extensionRequire = brackets.test.ExtensionLoader.getRequireContextForExtension("edge-code-informer");
                    informer = extensionRequire("informer");
                    jquery = testWindow.$;
                });
            });
        });

        afterLast(function () {
            runs(function () {
                SpecRunnerUtils.closeTestWindow(testWindow);
                extensionRequire = null;
                brackets = null;
                informer = null;
                testWindow = null;
                jquery = null;
            });
        });

        it("should be enabled by default", function () {
            var $toolbarIcon,
                $popupWindow;

            runs(function () {
                $toolbarIcon = jquery('.edge-code-informer-toolbar');
                $popupWindow = jquery('.edge-code-informer');
            });

            waits(100);

            runs(function () {
                expect($toolbarIcon.hasClass("edge-code-informer-disabled")).toBe(false);
                expect($popupWindow.hasClass("edge-code-informer-show")).toBe(false);
            });
        });

        it("should open the popup when the toolbar icon gets clicked", function () {
            runs(function () {
                var $toolbarIcon = jquery('.edge-code-informer-toolbar'),
                    $popupWindow = jquery('.edge-code-informer');

                $toolbarIcon.click();

                expect($popupWindow.hasClass("edge-code-informer-show")).toBe(true);

                $toolbarIcon.click();
            });
        });

        it("should enable submit button if something got entered into the textbox", function () {
            var $toolbarIcon,
                $popupWindow;

            runs(function () {
                $toolbarIcon = jquery('.edge-code-informer-toolbar');
                $popupWindow = jquery('.edge-code-informer');

                // make visible
                $toolbarIcon.click();

                var $textarea = jquery('.edge-code-informer-textarea');
                $textarea.val('Thanks for making this great product!');
                $textarea.keyup();
            });

            waits(100);

            runs(function () {
                expect($popupWindow.hasClass("edge-code-informer-show")).toBe(true);
                expect($popupWindow.find("input").attr("disabled")).toBeUndefined();

                $toolbarIcon.click();
            });
        });

        it("should show the thank you messager after submitting", function () {
            var $toolbarIcon,
                $popupWindow;

            spyOn(informer, 'postFeedback').andCallFake(function (feedbackText) {
                expect(feedbackText).toBe("Test");
            });

            runs(function () {
                $toolbarIcon = jquery('.edge-code-informer-toolbar');
                $popupWindow = jquery('.edge-code-informer');

                // make visible
                $toolbarIcon.click();

                var $textarea = jquery('.edge-code-informer-textarea');
                $textarea.val('Test');
                $textarea.keyup();
            });

            waits(100);

            runs(function () {
                $popupWindow.find("input").click();
            });

            waits(100);

            runs(function () {
                expect($popupWindow.find(".edge-code-informer-thanks").css("display")).toBe('block');
                expect($popupWindow.hasClass("edge-code-informer-show")).toBe(true);

                $toolbarIcon.click();
            });
        });
    });
});
