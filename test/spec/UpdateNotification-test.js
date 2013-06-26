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


/*jslint vars: true, plusplus: true, devel: true, browser: true, nomen: true, indent: 4, maxerr: 50, regexp: true */
/*global define, $, brackets, describe, it, expect, beforeEach, afterEach, waitsFor, waits, waitsForDone, runs, Mustache */
define(function (require, exports, module) {
    "use strict";
    
    // Load dependent modules
    var UpdateNotification, // Load from brackets.test
        SpecRunnerUtils     = require("spec/SpecRunnerUtils"),
        Async               = require("utils/Async");

    describe("UpdateNotification", function () {
        
        this.category = "integration";

        var updateInfoURL = "file://" + SpecRunnerUtils.getTestPath("/spec/UpdateNotification-test-files") + "/versionInfo.json",
            maliciousInfoURL = "file://" + SpecRunnerUtils.getTestPath("/spec/UpdateNotification-test-files") + "/versionInfoXSS.json",
            testWindow;

        beforeEach(function () {
            SpecRunnerUtils.createTestWindowAndRun(this, function (w) {
                testWindow = w;
                // Load module instances from brackets.test
                UpdateNotification = testWindow.brackets.test.UpdateNotification;
            });
        });

        afterEach(function () {
            testWindow         = null;
            UpdateNotification = null;
            SpecRunnerUtils.closeTestWindow();
        });

        it("should show a notification if an update is available", function () {
            var updateInfo = {
                _buildNumber: 72,
                _lastNotifiedBuildNumber: 0,
                _versionInfoURL: updateInfoURL
            };
            
            runs(function () {
                var promise = UpdateNotification.checkForUpdate(false, updateInfo);
                waitsForDone(promise, "Check for updates");
            });
            
            runs(function () {
                expect($(testWindow.document).find(".update-dialog.instance").length).toBe(1);
            });
        });
        
        it("should show update information for all available updates", function () {
            var updateInfo = {
                _buildNumber: 10,
                _lastNotifiedBuildNumber: 0,
                _versionInfoURL: updateInfoURL
            };
            
            runs(function () {
                var promise = UpdateNotification.checkForUpdate(false, updateInfo);
                waitsForDone(promise, "Check for updates");
            });
            
            runs(function () {
                var $doc = $(testWindow.document);
                expect($doc.find(".update-dialog.instance").length).toBe(1);
                expect($doc.find(".update-dialog.instance .update-info li").length).toBe(9);
            });
        });
        
        it("should not show dialog if user has already been notified", function () {
            var updateInfo = {
                _buildNumber: 10,
                _lastNotifiedBuildNumber: 93,
                _versionInfoURL: updateInfoURL
            };
            
            runs(function () {
                var promise = UpdateNotification.checkForUpdate(false, updateInfo);
                waitsForDone(promise, "Check for updates");
            });
            
            runs(function () {
                var $doc = $(testWindow.document);
                expect($doc.find(".update-dialog.instance").length).toBe(0);
            });
        });
        
        it("should not show dialog if app is up to date", function () {
            var updateInfo = {
                _buildNumber: 93,
                _lastNotifiedBuildNumber: 0,
                _versionInfoURL: updateInfoURL
            };
            
            runs(function () {
                var promise = UpdateNotification.checkForUpdate(false, updateInfo);
                waitsForDone(promise, "Check for updates");
            });
            
            runs(function () {
                var $doc = $(testWindow.document);
                expect($doc.find(".update-dialog.instance").length).toBe(0);
            });
        });
        
        it("should show an 'up to date' alert if no updates are available and the user manually checks for updates", function () {
            var updateInfo = {
                _buildNumber: 93,
                _lastNotifiedBuildNumber: 93,
                _versionInfoURL: updateInfoURL
            };
            
            runs(function () {
                var promise = UpdateNotification.checkForUpdate(true, updateInfo);
                waitsForDone(promise, "Check for updates");
            });
            
            runs(function () {
                var $doc = $(testWindow.document);
                // The "No Updates Found" dialog is actually an instance of error-dialog
                expect($doc.find(".error-dialog.instance").length).toBe(1);
            });
        });
        
        it("should sanitize text returned from server", function () {
            var updateInfo = {
                _buildNumber: 72,
                _lastNotifiedBuildNumber: 0,
                _versionInfoURL: maliciousInfoURL
            };
            
            runs(function () {
                var promise = UpdateNotification.checkForUpdate(true, updateInfo);
                waitsForDone(promise, "Check for updates");
            });
            
            runs(function () {
                var $doc = $(testWindow.document);
                expect($doc.find(".update-dialog.instance").length).toBe(1);
                // Check for "<script>" in the text. This means it wasn't stripped
                // out and run as a script.
                var txt = $doc.find(".update-dialog.instance .update-info li").text();
                expect(txt.indexOf("<script>")).toNotEqual(-1);
            });
        });
    });

    describe("SubscriptionStatus ", function () {
        
        this.category = "integration";

        var updateInfoURL = "file://" + SpecRunnerUtils.getTestPath("/spec/UpdateNotification-test-files") + "/versionInfo.json?level={{level}}",
            testWindow;
        
        beforeEach(function () {
            SpecRunnerUtils.createTestWindowAndRun(this, function (w) {
                testWindow = w;
                // Load module instances from brackets.test
                UpdateNotification = testWindow.brackets.test.UpdateNotification;
            });
        });

        afterEach(function () {
            SpecRunnerUtils.closeTestWindow();
        });
        
        it("should not include subscription status if last subscription update was less than a week ago", function () {
            var updateInfo = {
                _buildNumber: 93,
                _versionInfoURL: updateInfoURL,
                _lastNotifiedBuildNumber: 0,
                _lastInfoURLFetchTime: 0,
                _lastUsageReportTime: Date.now() - (1000 * 60 * 60 * 24 * 6) // 6 days ago
            };
            
            runs(function () {
                var promise = UpdateNotification.checkForUpdate(false, updateInfo);
                waitsForDone(promise, "Check for updates", 30000);
            });
            
            runs(function () {
                var settings = {
                    level: "3"
                };
                var expectedURL = Mustache.render(updateInfoURL, settings);
                
                expect(UpdateNotification._lastRequest.url).toBe(expectedURL);
            });
        });
        
        it("should include subscription status if last subscription update was more than a week ago", function () {
            var updateInfo = {
                _buildNumber: 93,
                _versionInfoURL: updateInfoURL,
                _lastNotifiedBuildNumber: 0,
                _lastInfoURLFetchTime: 0,
                _lastUsageReportTime: Date.now() - (1000 * 60 * 60 * 24 * 8) // 8 days ago
            };
            
            runs(function () {
                var promise = UpdateNotification.checkForUpdate(false, updateInfo);
                waitsForDone(promise, "Check for updates", 30000);
            });
            
            runs(function () {
                var settings = {
                    level: "[0-2]" // this actually calls into IMSLib so the level is unknown
                };
                var expectedURL = Mustache.render(updateInfoURL, settings)
                        .replace(/\?/g, "\\?")
                        .replace(/\./g, "\\.");
                
                expect(UpdateNotification._lastRequest.url).toMatch(new RegExp(expectedURL));
            });
        });
        
        it("should report subscription status of users with free subscriptions", function () {
            var updateInfo = {
                _buildNumber: 93,
                _versionInfoURL: updateInfoURL,
                _lastNotifiedBuildNumber: 0,
                _lastInfoURLFetchTime: 0,
                _lastUsageReportTime: Date.now() - (1000 * 60 * 60 * 24 * 8) // 8 days ago
            };
            
            runs(function () {
                testWindow.brackets.app.getSubscriptionStatusSave = testWindow.brackets.app.getSubscriptionStatus;
                testWindow.brackets.app.getSubscriptionStatus = function (callback) {
                    testWindow.setTimeout(function () {
                        callback(brackets.fs.NO_ERROR, "FREE_LVL_1");
                    }, 0);
                };
                
                var promise = UpdateNotification.checkForUpdate(false, updateInfo);
                waitsForDone(promise, "Check for updates", 30000);
            });
             
            runs(function () {
                var settings = {
                    level: 1
                };
                var expectedURL = Mustache.render(updateInfoURL, settings);

                expect(UpdateNotification._lastRequest.url).toBe(expectedURL);
                
                testWindow.brackets.app.getSubscriptionStatus = testWindow.brackets.app.getSubscriptionStatusSave;
                delete testWindow.brackets.app.getSubscriptionStatusSave;
            });
        });
        
        it("should report subscription status of users with paid subscriptions", function () {
            var updateInfo = {
                _buildNumber: 93,
                _versionInfoURL: updateInfoURL,
                _lastNotifiedBuildNumber: 0,
                _lastInfoURLFetchTime: 0,
                _lastUsageReportTime: Date.now() - (1000 * 60 * 60 * 24 * 8) // 8 days ago
            };
            
            runs(function () {
                testWindow.brackets.app.getSubscriptionStatusSave = testWindow.brackets.app.getSubscriptionStatus;
                testWindow.brackets.app.getSubscriptionStatus = function (callback) {
                    testWindow.setTimeout(function () {
                        callback(brackets.fs.NO_ERROR, "CS_LVL_2");
                    }, 0);
                };
                
                var promise = UpdateNotification.checkForUpdate(false, updateInfo);
                waitsForDone(promise, "Check for updates", 30000);
            });
             
            runs(function () {
                var settings = {
                    level: 2
                };
                var expectedURL = Mustache.render(updateInfoURL, settings);

                expect(UpdateNotification._lastRequest.url).toBe(expectedURL);
                
                testWindow.brackets.app.getSubscriptionStatus = testWindow.brackets.app.getSubscriptionStatusSave;
                delete testWindow.brackets.app.getSubscriptionStatusSave;
            });
        });
        
        it("should report subscription status of users with unknown subscriptions", function () {
            var updateInfo = {
                _buildNumber: 93,
                _versionInfoURL: updateInfoURL,
                _lastNotifiedBuildNumber: 0,
                _lastInfoURLFetchTime: 0,
                _lastUsageReportTime: Date.now() - (1000 * 60 * 60 * 24 * 8) // 8 days ago
            };
            
            runs(function () {
                testWindow.brackets.app.getSubscriptionStatusSave = testWindow.brackets.app.getSubscriptionStatus;
                testWindow.brackets.app.getSubscriptionStatus = function (callback) {
                    testWindow.setTimeout(function () {
                        callback(brackets.fs.NO_ERROR, "");
                    }, 0);
                };
                
                var promise = UpdateNotification.checkForUpdate(false, updateInfo);
                waitsForDone(promise, "Check for updates", 30000);
            });
             
            runs(function () {
                var settings = {
                    level: 0
                };
                var expectedURL = Mustache.render(updateInfoURL, settings);

                expect(UpdateNotification._lastRequest.url).toBe(expectedURL);
                
                testWindow.brackets.app.getSubscriptionStatus = testWindow.brackets.app.getSubscriptionStatusSave;
                delete testWindow.brackets.app.getSubscriptionStatusSave;
            });
        });
        
        it("should report cached subscription status on error if possible", function () {
            var updateInfo = {
                _buildNumber: 93,
                _versionInfoURL: updateInfoURL,
                _lastNotifiedBuildNumber: 0,
                _lastInfoURLFetchTime: 0,
                _lastUsageReportTime: Date.now() - (1000 * 60 * 60 * 24 * 8) // 8 days ago
            };
            
            runs(function () {
                testWindow.brackets.app.getSubscriptionStatusSave = testWindow.brackets.app.getSubscriptionStatus;
                testWindow.brackets.app.getSubscriptionStatus = function (callback) {
                    testWindow.setTimeout(function () {
                        callback(brackets.fs.NO_ERROR, "CS_LVL_2");
                    }, 0);
                };
                
                var promise = UpdateNotification.checkForUpdate(false, updateInfo);
                waitsForDone(promise, "Check for updates", 10000);
            });
            
            runs(function () {
                testWindow.brackets.app.getSubscriptionStatus = function (callback) {
                    testWindow.setTimeout(function () {
                        callback(999, "");
                    }, 0);
                };
                
                var promise = UpdateNotification.checkForUpdate(false, updateInfo);
                waitsForDone(promise, "Check for updates", 30000);
            });
            
            runs(function () {
                var settings = {
                    level: 2
                };
                var expectedURL = Mustache.render(updateInfoURL, settings);

                expect(UpdateNotification._lastRequest.url).toBe(expectedURL);
                
                testWindow.brackets.app.getSubscriptionStatus = testWindow.brackets.app.getSubscriptionStatusSave;
                delete testWindow.brackets.app.getSubscriptionStatusSave;
            });
        });
        
        it("should report unknown subscription status on error if no cached value", function () {
            var updateInfo = {
                _buildNumber: 93,
                _versionInfoURL: updateInfoURL,
                _lastNotifiedBuildNumber: 0,
                _lastInfoURLFetchTime: 0,
                _lastUsageReportTime: Date.now() - (1000 * 60 * 60 * 24 * 8) // 8 days ago
            };
            
            runs(function () {
                testWindow.brackets.app.getSubscriptionStatusSave = testWindow.brackets.app.getSubscriptionStatus;
                testWindow.brackets.app.getSubscriptionStatus = function (callback) {
                    testWindow.setTimeout(function () {
                        callback(999, "");
                    }, 0);
                };
                
                var promise = UpdateNotification.checkForUpdate(false, updateInfo);
                waitsForDone(promise, "Check for updates", 30000);
            });
             
            runs(function () {
                var settings = {
                    level: 0
                };
                var expectedURL = Mustache.render(updateInfoURL, settings);

                expect(UpdateNotification._lastRequest.url).toBe(expectedURL);
                
                testWindow.brackets.app.getSubscriptionStatus = testWindow.brackets.app.getSubscriptionStatusSave;
                delete testWindow.brackets.app.getSubscriptionStatusSave;
            });
        });
    });
});
