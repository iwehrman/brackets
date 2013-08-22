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
/*global define, describe, it, xit, expect, beforeEach, beforeFirst, afterEach, afterLast, waitsFor, runs, $, brackets, waitsForDone, waitsForFail, spyOn */

define(function (require, exports, module) {
    "use strict";

    var SpecRunnerUtils = brackets.getModule("spec/SpecRunnerUtils");

    var TEST_KULER_JSON = require("text!unittest-files/mytheme-kuler.json");

    describe("Kuler", function () {

        var testWindow,
            brackets,
            Kuler,
            extensionRequire;

        beforeFirst(function () {
            runs(function () {
                SpecRunnerUtils.createTestWindowAndRun(this, function (w) {
                    testWindow = w;
                    // Load module instances from brackets.test
                    brackets = testWindow.brackets;
                    extensionRequire = brackets.test.ExtensionLoader.getRequireContextForExtension("edge-code-kuler");
                    Kuler = extensionRequire("kuler");
                });
            });
        });

        afterLast(function () {
            runs(function () {
                SpecRunnerUtils.closeTestWindow(testWindow);
                Kuler = null;
                extensionRequire = null;
                brackets = null;
                testWindow = null;
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
                promise = Kuler.getThemes("MY_KULER_THEMES");

                waitsForFail(promise, "Nothing will be returned", 5000);
            });

            delete brackets.authentication;
        });

        describe("Return proper kuler resource urls", function () {
            it("should return proper request url for my themes", function () {
                var url = Kuler.COLLECTION_URLS.MY_KULER_THEMES;

                expect(url).toBe("https://www.adobeku.com/api/v2/themes?filter=my_themes&maxNumber=60&metadata=all");
            });

            it("should return proper request url for my favorites", function () {
                var url = Kuler.COLLECTION_URLS.FAVORITE_KULER_THEMES;

                expect(url).toBe("https://www.adobeku.com/api/v2/themes?filter=likes&maxNumber=60&metadata=all");
            });

            it("should return proper request url for random themes", function () {
                var url = Kuler.COLLECTION_URLS.RANDOM_KULER_THEMES;

                expect(url).toBe("https://www.adobeku.com/api/v2/themes?filter=public&maxNumber=60&metadata=all&sort=random");
            });

            it("should return proper request url for popular themes", function () {
                var url = Kuler.COLLECTION_URLS.POPULAR_KULER_THEMES;

                expect(url).toBe("https://www.adobeku.com/api/v2/themes?filter=public&maxNumber=60&metadata=all&sort=view_count&time=month");
            });
        });

        describe("Extract information from Kuler JSON", function () {
            it("should return the parsed JSON themes", function () {
                var promise,
                    theme;

                brackets.authentication = {};
                brackets.authentication.getAccessToken = function () {
                    return new $.Deferred().resolve("actoken").promise();
                };

                spyOn(Kuler, "_executeAjaxRequest").andCallFake(function (requestConfig) {
                    return new $.Deferred().resolve(JSON.parse(TEST_KULER_JSON)).promise();
                });

                runs(function () {
                    Kuler.flushCachedThemes();
                    promise = Kuler.getThemes(Kuler.COLLECTION_MY_THEMES, true);

                    promise.done(function (parsedJSON) {
                        theme = parsedJSON;
                    });

                    promise.fail(function (err) {
                        console.log(err);
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
                    delete brackets.authentication;
                });
            });

            it("should return rudimentary JSON if no theme is available", function () {
                var promise,
                    theme;

                brackets.authentication = {};
                brackets.authentication.getAccessToken = function () {
                    return new $.Deferred().resolve("token").promise();
                };

                spyOn(Kuler, "_executeAjaxRequest").andCallFake(function (requestConfig) {
                    return new $.Deferred().resolve(JSON.parse('{"totalCount": 0, "themes": []}')).promise();
                });

                runs(function () {
                    Kuler.flushCachedThemes();
                    promise = Kuler.getThemes("MY_KULER_THEMES", true);

                    promise.done(function (parsedJSON) {
                        theme = parsedJSON;
                    });

                    waitsForDone(promise, "No JSON from Kuler");
                });

                runs(function () {
                    expect(theme.totalCount).toBe(0);
                    expect(theme.themes.length).toBe(0);
                });

                runs(function () {
                    // cleanup
                    delete brackets.authentication;
                });
            });

            it("should return cached theme for the second call", function () {
                var promise,
                    theme1,
                    theme2,
                    called = 0;

                brackets.authentication = {};
                brackets.authentication.getAccessToken = function () {
                    return new $.Deferred().resolve("token").promise();
                };

                spyOn(Kuler, "_executeAjaxRequest").andCallFake(function (requestConfig) {
                    called += 1;
                    return new $.Deferred().resolve(JSON.parse(TEST_KULER_JSON)).promise();
                });

                runs(function () {
                    Kuler.flushCachedThemes();
                    promise = Kuler.getThemes("MY_KULER_THEMES", true);

                    promise.done(function (parsedJSON) {
                        theme1 = parsedJSON;
                    });

                    waitsForDone(promise, "Some JSON from Kuler");
                });

                runs(function () {
                    promise = Kuler.getThemes("MY_KULER_THEMES");

                    promise.done(function (parsedJSON) {
                        theme2 = parsedJSON;
                    });

                    waitsForDone(promise, "Some JSON from Kuler");
                });

                runs(function () {
                    expect(theme1).toEqual(theme2);
                    expect(called).toBe(1);
                });

                runs(function () {
                    // cleanup
                    delete brackets.authentication;
                });
            });
        });
    });
});

