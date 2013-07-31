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
/*global define, describe, it, xit, expect, beforeEach, afterEach, waitsFor, runs, $, brackets, waitsForDone, waitsForFail, spyOn */

define(function (require, exports, module) {
    "use strict";

    var SpecRunnerUtils = brackets.getModule("spec/SpecRunnerUtils"),
        Kuler           = require("kuler");

    require("thirdparty/jquery.mockjax.js");

    var TEST_KULER_JSON = require("text!unittest-files/mytheme-kuler.json");

    describe("Kuler", function () {
        it("should be able to retrieve Themes for the currently logged-in user", function () {
            var promise;

            runs(function () {
                promise = Kuler.getMyThemes(true);

                waitsForDone(promise, "Get My Themes", 5000);
            });
        });

        it("should be able to retrieve Favorite Themes for the currently logged-in user", function () {
            var promise;

            runs(function () {
                promise = Kuler.getFavoriteThemes(true);

                waitsForDone(promise, "Get FavoriteThemes", 5000);
            });
        });

        it("should return nothing if no access token can be aquired", function () {
            var promise;

            runs(function () {
                brackets.authentication = {};
                brackets.authentication.getAccessToken = function () {
                    return new $.Deferred().reject().promise();
                };

                Kuler.flushCachedThemes();
                promise = Kuler.getMyThemes(true);

                waitsForFail(promise, "Nothing will be returned", 5000);
            });

            delete brackets.authentication;
        });

        describe("Return proper kuler resource urls", function () {
            it("should return proper resource URLs", function () {
                var themesUrl = Kuler._constructKulerURL('themes');

                expect(themesUrl).toBe("https://www.adobeku.com/api/v2/themes");

                var searchUrl = Kuler._constructKulerURL('search');

                expect(searchUrl).toBe("https://www.adobeku.com/api/v2/search");
            });

            it("should return proper request url for my themes", function () {
                var myThemesUrl = Kuler._constructMyThemesRequestURL();

                expect(myThemesUrl).toBe("https://www.adobeku.com/api/v2/themes?filter=my_themes");
            });

            it("should return proper request url for my favorites", function () {
                var myFavoritesUrl = Kuler._constructMyFavoritesRequestURL();

                expect(myFavoritesUrl).toBe("https://www.adobeku.com/api/v2/themes?filter=my_kuler");
            });
        });

        describe("Extract information from Kuler JSON", function () {
            it("should return the parsed JSON with one theme", function () {
                var promise,
                    theme,
                    mockjaxid;

                brackets.authentication = {};
                brackets.authentication.getAccessToken = function () {
                    return new $.Deferred().resolve("actoken").promise();
                };

                mockjaxid = $.mockjax({
                    url : Kuler._constructMyThemesRequestURL(),
                    contentType: 'text/json',
                    responseText : TEST_KULER_JSON
                });

                runs(function () {
                    Kuler.flushCachedThemes();
                    promise = Kuler.getMyThemes(true);

                    promise.done(function (parsedJSON) {
                        theme = parsedJSON;
                    });

                    waitsForDone(promise, "Return the parsed JSON from Kuler");
                });

                runs(function () {
                    expect(theme.themes[0].name).toBe("Test Theme");
                    expect(theme.themes[0].swatches[0].hex).toBe("FF530D");
                    expect(theme.themes[0].swatches[1].hex).toBe("E82C0C");
                    expect(theme.themes[0].swatches[2].hex).toBe("FF0000");
                    expect(theme.themes[0].swatches[3].hex).toBe("E80C7A");
                    expect(theme.themes[0].swatches[4].hex).toBe("FF0DFF");
                });

                runs(function () {
                    // cleanup
                    $.mockjaxClear(mockjaxid);
                    delete brackets.authentication;
                });
            });

            it("should return nothing if no theme is available", function () {
                var promise,
                    theme,
                    mockjaxid;

                brackets.authentication = {};
                brackets.authentication.getAccessToken = function () {
                    return new $.Deferred().resolve("actoken").promise();
                };

                mockjaxid = $.mockjax({
                    url : Kuler._constructMyThemesRequestURL(),
                    status : 400
                });

                runs(function () {
                    Kuler.flushCachedThemes();
                    promise = Kuler.getMyThemes(true);

                    waitsForFail(promise, "No JSON from Kuler");
                });

                runs(function () {
                    // cleanup
                    $.mockjaxClear(mockjaxid);
                    delete brackets.authentication;
                });
            });
        });
    });
});