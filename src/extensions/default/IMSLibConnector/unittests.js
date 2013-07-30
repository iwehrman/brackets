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

    var SpecRunnerUtils = brackets.getModule("spec/SpecRunnerUtils");
    
    var authStatus = {"countryCode" : "US",
                          "displayName" : "Joe Average",
                          "email" : "joe.average@adobe.com",
                          "emailVerified" : "true",
                          "first_name" : "Joe",
                          "last_name" : "Average",
                          "name" : "Joe Average",
                          "phoneNumber" : "4151234567",
                          "userId" : "ABCDEFGHIJKLMNOPQRST@AdobeID",
                          "access_token" : "eyJhbGciOiJSUzI1NiJ9.eyJpZCI6IjEzNzMzOTQyNTQzMjMtNTYxZmYyYWUtMWI5OC00ZTY4LWIzMzMtYWQwMWNkZGE0OTZlIiwic2NvcGUiOiJBZG9iZUlELG9wZW5pZCIsImFzIjoiaW1zLW5hMSIsImNyZWF0ZWRfYXQiOiIxMzczMzk0MjU0MzIzIiwiZXhwaXJlc19pbiI6Ijg2NDAwMDAwIiwidXNlcl9pZCI6IjQ3RDUzMTY2NDQ0RTMyQ0U5OTIwMTZCOEBBZG9iZUlEIiwiY2xpZW50X2lkIjoiQWRvYmVTaGFkb3cxIiwidHlwZSI6ImFjY2Vzc190b2tlbiJ9.KIQkR0LzzCJv8PaUKjEVpVO9Ih-mgOw2l_FRkYCtygiU8M5qYuEvj7VH78amBxZIJz7H664s2mEWQQatHG0YZ64qigyRt7ke8zpD-Bv5zT-kqM5jggPyLDhRGQ1Ac9vH5IEH9oHXVnyohTS0c9VnNOz04R8gE2GXiw76LAlI8cs1qFhj1cfsnNAGNgrY1Lncca3PaYuCCQIO0fUn0zQvEpkGJPbDr8AvX3UmuG3gLQsdTIaZop1-RMAY4L3U9nfmUYTS-LvDQXOs85ngzs5Vph0AKepxvWyNmh1yJJLgtlFMGqSMCg6y_QsM1Og2HZrrAVmIfHyE_HJBCMsl1-empw",
                          "expires_in" : "673768632",
                          "refresh_token" : "hghjkdfhj",
                          "token_type" : "bearer"};
    
    var authStatusJSON = JSON.stringify(authStatus);
    
    var badAuthStatusJSON = "!@#" + authStatusJSON;

    describe("Creative Cloud IMSLib Integration", function () {
        describe("Return valid information for logged in user", function () {
            
            var testWindow,
                brackets,
                IMSConnector,
                extensionRequire;
            
            beforeEach(function () {
                runs(function () {
                    SpecRunnerUtils.createTestWindowAndRun(this, function (w) {
                        testWindow = w;
                        // Load module instances from brackets.test
                        brackets = testWindow.brackets;
                        extensionRequire = brackets.test.ExtensionLoader.getRequireContextForExtension("IMSLibConnector");
                        IMSConnector = extensionRequire("main");
                    });
                });

                runs(function () {
                    IMSConnector._invalidateCache();

                    // Wait for any pending auth status promises to finish up
                    waitsForDone(IMSConnector._getAuthStatus(), "Cache warm-up");
                });
            });
            
            afterEach(function () {
                SpecRunnerUtils.closeTestWindow(testWindow);
                IMSConnector = null;
                extensionRequire = null;
                brackets = null;
                testWindow = null;
            });

            var IMS_NO_ERROR = 0,
                IMS_ERROR = 1,
                IMS_CALL_PENDING = 11;

            it("should return an access token for the authorized user", function () {
                var promise,
                    accessToken;

                runs(function () {
                    spyOn(brackets.app, 'getAuthorizedUser').andCallFake(function (callback) {
                        callback(IMS_NO_ERROR, authStatusJSON);
                    });

                    promise = brackets.authentication.getAccessToken(true);

                    promise.done(function (token) {
                        accessToken = token;
                    });

                    waitsForDone(promise, "Get access token");
                });

                runs(function () {
                    expect(accessToken).toEqual(authStatus.access_token);
                });
            });

            it("should return no access token in case of an error", function () {
                var promise,
                    accessToken,
                    errorCode;

                runs(function () {
                    spyOn(brackets.app, 'getAuthorizedUser').andCallFake(function (callback) {
                        callback(IMS_ERROR, undefined);
                    });

                    promise = brackets.authentication.getAccessToken(true);

                    promise.done(function (testAccessToken) {
                        accessToken = testAccessToken;
                    });

                    promise.fail(function (testErrorCode) {
                        errorCode = testErrorCode;
                    });

                    waitsForFail(promise, "Get access token");
                });

                runs(function () {
                    expect(accessToken).toBeUndefined();
                    expect(errorCode).toBe(IMS_ERROR);
                });
            });

            it("should return an error if the json from imslib is not well formed", function () {
                var promise,
                    errorObject;

                runs(function () {
                    spyOn(brackets.app, 'getAuthorizedUser').andCallFake(function (callback) {
                        callback(IMS_NO_ERROR, badAuthStatusJSON);
                    });

                    promise = brackets.authentication.getAccessToken(true);
                    
                    promise.fail(function (testErrorObject) {
                        errorObject = testErrorObject;
                    });

                    waitsForFail(promise, "Get access token");
                });
                
                runs(function () {
                    expect(errorObject).toBeTruthy();
                });
            });

            it("should return information about the authorized user", function () {
                var promise,
                    authorizedUserInfo;

                runs(function () {
                    spyOn(brackets.app, 'getAuthorizedUser').andCallFake(function (callback) {
                        callback(IMS_NO_ERROR, authStatusJSON);
                    });

                    promise = brackets.authentication.getAuthorizedUser(true);

                    promise.done(function (testAuthorizedUserInfo) {
                        authorizedUserInfo = testAuthorizedUserInfo;
                    });

                    waitsForDone(promise, "Get authorized user info");
                });

                runs(function () {
                    expect(authorizedUserInfo.countryCode).toEqual("US");
                    expect(authorizedUserInfo.displayName).toEqual("Joe Average");
                    expect(authorizedUserInfo.email).toEqual("joe.average@adobe.com");
                    expect(authorizedUserInfo.emailVerified).toBeTruthy(true);
                    expect(authorizedUserInfo.first_name).toEqual("Joe");
                    expect(authorizedUserInfo.last_name).toEqual("Average");
                    expect(authorizedUserInfo.name).toEqual("Joe Average");
                    expect(authorizedUserInfo.phoneNumber).toEqual("4151234567");
                    expect(authorizedUserInfo.userId).toEqual("ABCDEFGHIJKLMNOPQRST@AdobeID");

                    // don't expect anything related to authorization
                    expect(authorizedUserInfo.access_token).toBeUndefined();
                    expect(authorizedUserInfo.expires_in).toBeUndefined();
                    expect(authorizedUserInfo.refresh_token).toBeUndefined();
                    expect(authorizedUserInfo.token_type).toBeUndefined();
                });
            });

            it("should return an error if the json from imslib is not well formed", function () {
                var promise,
                    errorObject;

                runs(function () {
                    spyOn(brackets.app, 'getAuthorizedUser').andCallFake(function (callback) {
                        callback(IMS_NO_ERROR, badAuthStatusJSON);
                    });

                    promise = brackets.authentication.getAuthorizedUser(true);

                    promise.fail(function (testErrorObject) {
                        errorObject = testErrorObject;
                    });

                    waitsForFail(promise, "Get authorized user info");
                });
                
                runs(function () {
                    expect(errorObject).toBeTruthy();
                });
            });

            it("should return no information in case of an error", function () {
                var promise,
                    authorizedUserInfo,
                    errorCode;

                runs(function () {
                    spyOn(brackets.app, 'getAuthorizedUser').andCallFake(function (callback) {
                        callback(IMS_ERROR, undefined);
                    });

                    promise = brackets.authentication.getAuthorizedUser(true);

                    promise.done(function (testAuthorizedUserInfo) {
                        authorizedUserInfo = testAuthorizedUserInfo;
                    });

                    promise.fail(function (testErrorCode) {
                        errorCode = testErrorCode;
                    });

                    waitsForFail(promise, "Get authorized user info");
                });

                runs(function () {
                    expect(authorizedUserInfo).toBeUndefined();
                    expect(errorCode).toBe(IMS_ERROR);
                });
            });

            it("should return an access token for the authorized user after pending IMSLib call finished", function () {
                var promise,
                    accessToken,
                    timesCalled = 0;

                runs(function () {
                    spyOn(brackets.app, 'getAuthorizedUser').andCallFake(function (callback) {
                        if (timesCalled === 0) {
                            timesCalled++;
                            callback(IMS_CALL_PENDING);
                        } else {
                            callback(IMS_NO_ERROR, authStatusJSON);
                        }
                    });

                    promise = brackets.authentication.getAccessToken(true);

                    promise.done(function (testAccessToken) {
                        accessToken = testAccessToken;
                    });

                    waitsForDone(promise, "Get access token");
                });

                runs(function () {
                    expect(accessToken).toEqual(authStatus.access_token);
                });
            });
        });
    });
});