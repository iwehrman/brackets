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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, PathUtils, window, Mustache */

/**
 *  Utilities functions for displaying update notifications
 *
 */
define(function (require, exports, module) {
    "use strict";
    
    var Dialogs              = require("widgets/Dialogs"),
        DefaultDialogs       = require("widgets/DefaultDialogs"),
        NativeApp            = require("utils/NativeApp"),
        PreferencesManager   = require("preferences/PreferencesManager"),
        Strings              = require("strings"),
        Urls                 = require("i18n!nls/urls"),
        StringUtils          = require("utils/StringUtils"),
        Global               = require("utils/Global"),
        UpdateDialogTemplate = require("text!htmlContent/update-dialog.html"),
        UpdateListTemplate   = require("text!htmlContent/update-list.html");
    
    var defaultPrefs = {
            lastNotifiedBuildNumber : 0,
            lastInfoURLFetchTime    : 0,
            lastUsageReportTime     : 0,
            lastSubscriptionLevel   : 0
        };
    
    // Extract current build number from package.json version field 0.0.0-0
    var _buildNumber = Number(/-([0-9]+)/.exec(brackets.metadata.version)[1]);
    
    // PreferenceStorage
    var _prefs = PreferencesManager.getPreferenceStorage(module, defaultPrefs);
    //TODO: Remove preferences migration code
    PreferencesManager.handleClientIdChange(_prefs, module.id);
    
    // This is the last version we notified the user about. If checkForUpdate()
    // is called with "false", only show the update notification dialog if there
    // is an update newer than this one. This value is saved in preferences.
    var _lastNotifiedBuildNumber = _prefs.getValue("lastNotifiedBuildNumber");
    
    // Last time the versionInfoURL was fetched
    var _lastInfoURLFetchTime = _prefs.getValue("lastInfoURLFetchTime");
    
    // Last time subscription status was reported
    var _lastUsageReportTime = _prefs.getValue("lastUsageReportTime");
    
    // Mustache template for the URL at which version information is found.
    // By default this is loaded no more than once a day. If you force an
    // update check it is always loaded.
    // 
    // @param {Number} level - subscription level
    // @param {String} locale - the current locale
    var _versionInfoURL;
    
    // Information about the last version info request. Only used for unit testing.
    var _lastRequest = {};
    
    // Information on all posted builds of Brackets. This is an Array, where each element is 
    // an Object with the following fields:
    //
    //  {Number} buildNumber Number of the build
    //  {String} versionString String representation of the build number (ie "Sprint 14")
    //  {String} dateString Date of the build
    //  {String} releaseNotesURL URL of the release notes for this build
    //  {String} downloadURL URL to download this build
    //  {Array} newFeatures Array of new features in this build. Each entry has two fields:
    //      {String} name Name of the feature
    //      {String} description Description of the feature
    //
    // This array must be reverse sorted by buildNumber (newest build info first)
    
    /**
     * @private
     * Flag that indicates if we've added a click handler to the update notification icon.
     */
    var _addedClickHandler = false;
    
    // Subscription level constants. The values are important. See: 
    // https://zerowing.corp.adobe.com/display/helium/Tracking+weekly+usage+for+all+users
    var _subscriptionLevel = {
        unknown : 0,
        free    : 1,
        paid    : 2,
        none    : 3
    };
    
    /**
     * Translate a subscription status string to a subscription level.
     * 
     * @param {?String} status - the subscription status; empty if unknown
     * @return {Number} - the subscription level
     */
    function _getSubscriptionLevel(status) {
        switch (status.toUpperCase()) {
        case "FREE_LVL_1":
        case "FREE_LVL_2":
        case "CS_LVL_1":
            return _subscriptionLevel.free;
        case "CS_LVL_2":
            return _subscriptionLevel.paid;
        default:
            return _subscriptionLevel.unknown;
        }
    }
    
    /** 
     * Get the version info URL for the current locale and the given
     * subscription level.
     * 
     * @param {Number} level - subscription level
     * @return {String} the version info URL
     */
    function _getVersionInfoURL(level) {
        var settings = {
            level: level
        };
        
        return Mustache.render(_versionInfoURL, settings);
    }
    
    /**
     * Get a data structure that has information for all builds of Brackets.
     *
     * If force is true, the information is always fetched from _versionInfoURL.
     * If force is false, we try to use cached information. If more than
     * 24 hours have passed since the last fetch, or if cached data can't be found, 
     * the data is fetched again.
     *
     * If new data is fetched and cacheData is true, the data is saved in preferences
     * for quick fetching later.
     */
    function _getUpdateInformation(force, cacheData) {
        var result      = new $.Deferred(),
            oldVersions = _prefs.getValue("updateInfo"),
            oneDay      = 1000 * 60 * 60 * 24,
            oneWeek     = oneDay * 7,
            now         = Date.now(),
            level,
            requestURL;
        
        /*
         * Get user's Creative Cloud subscription status
         *
         * @return {$.Promise} a jQuery promise that will be resolved when the shell API call completes.
         */
        function getSubscriptionStatus() {
            var result = new $.Deferred();

            brackets.app.getSubscriptionStatus(function (err, status) {
                if (err === brackets.fs.NO_ERROR) {
                    result.resolve(status);
                } else {
                    result.reject(err);
                }
            });
            
            return result.promise();
        }
        
        /*
         * Make an ajax request to the specified URL to get version update info
         * (and possibly report usage via the URL).
         *
         * @param {string} URL - URL to query for version info.
         * @return {jQuery.Promise} - HTTP request promise
         */
        function makeVersionRequest(url) {
            var settings    = { dataType: "text", cache: false},
                promise     = $.ajax(url, settings);
            
            // for unit testing
            _lastRequest.url = url;
            
            promise.done(function (response) {
                try {
                    var versions = JSON.parse(response);
                    if (cacheData) {
                        _lastInfoURLFetchTime = Date.now();
                        _prefs.setValue("lastInfoURLFetchTime", _lastInfoURLFetchTime);
                        _prefs.setValue("updateInfo", versions);
                    }
                    result.resolve(versions);
                } catch (e) {
                    console.log("Error parsing version information");
                    console.log(e);
                    result.reject();
                }
            }).fail(function (jqXHR) {
                // When loading data for unit tests, the error handler is 
                // called but the responseText is valid. Try to use it here,
                // but *don't* save the results in prefs.
                
                var response = jqXHR.responseText;
                if (!response) {
                    // Text is NULL or empty string, reject().
                    result.reject();
                } else {
                    try {
                        var versions = JSON.parse(response);
                        result.resolve(versions);
                    } catch (e) {
                        result.reject();
                    }
                }
            });
            
            return promise;
        }
        
        // If force is true, or if we don't have old version info saved in 
        // prefs, or if more than 24 hours have passed since our last fetch,
        // then fetch new version info
        if (force || !oldVersions || (now > _lastInfoURLFetchTime + oneDay)) {
            // add subscription status if last fetch was more than a week ago
            if (now > _lastUsageReportTime + oneWeek) {
                getSubscriptionStatus().done(function (status) {
                    level = _getSubscriptionLevel(status);
                    requestURL = _getVersionInfoURL(level);

                    // cache the subscription level in case we can't get it next time
                    _prefs.setValue("lastSubscriptionLevel", level);
                }).fail(function (err) {
                    // we couldn't get the subscription level, so try the cached value
                    level = _prefs.getValue("lastSubscriptionLevel");
                    requestURL = _getVersionInfoURL(level);
                    
                    // don't cache the response if the request failed
                    cacheData = false;
                }).always(function () {
                    makeVersionRequest(requestURL).done(function () {
                        _lastUsageReportTime = Date.now();
                        _prefs.setValue("lastUsageReportTime", _lastUsageReportTime);
                    });
                });
            } else {
                // otherwise, check for a new version without the subscription status
                requestURL = _getVersionInfoURL(_subscriptionLevel.none);
                makeVersionRequest(requestURL);
            }
        } else {
            // otherwise, use the old version info
            result.resolve(oldVersions);
        }

        return result.promise();
    }
    
    /**
     * Return a new array of version information that is newer than "buildNumber".
     * Returns null if there is no new version information.
     */
    function _stripOldVersionInfo(versionInfo, buildNumber) {
        // Do a simple linear search. Since we are going in reverse-chronological order, we
        // should get through the search quickly.
        var lastIndex = 0;
        var len = versionInfo.length;
        
        while (lastIndex < len) {
            if (versionInfo[lastIndex].buildNumber <= buildNumber) {
                break;
            }
            lastIndex++;
        }
        
        if (lastIndex > 0) {
            return versionInfo.slice(0, lastIndex);
        }
        
        // No new version info
        return null;
    }
    
    /**
     * Open CC app web page in the default browser
     */
    function _launchCCAppWebPage() {
        var URL = Urls.UPDATE_DOWNLOAD_URL;
        NativeApp.openURLInDefaultBrowser(URL);
    }
    
    /**
     * Open AAM if it's installed; otherwise open CC app web page
     */
    function _launchAAM() {
        var _openAAMCallback = function (code) {
            if (code !== brackets.fs.NO_ERROR) {
                _launchCCAppWebPage();
            }
        };

        brackets.app.openAAM(_openAAMCallback);
    }
    
    /**
     * Show a dialog that shows the update 
     */
    function _showUpdateNotificationDialog(updates) {
        Dialogs.showModalDialogUsingTemplate(Mustache.render(UpdateDialogTemplate, Strings))
            .done(function (id) {
                if (id === Dialogs.DIALOG_BTN_DOWNLOAD) {
                    // For now, we open the CC app web page instead of launching
                    // a native application manager like AAM
                    _launchCCAppWebPage();
                    
                    // Replace the line above with the one below to launch AAM instead
                    //_launchAAM();
                }
            });
        
        // Populate the update data
        var $dlg = $(".update-dialog.instance");
        var $updateList = $dlg.find(".update-info");
        var templateVars = $.extend(updates, Strings);
        
        $updateList.html(Mustache.render(UpdateListTemplate, templateVars));
        
        $dlg.on("click", "a", function (e) {
            var url = $(e.target).attr("data-url");
            if (url) {
                // Make sure the URL has a domain that we know about
                if (/(brackets\.io|github\.com|adobe\.com)$/i.test(PathUtils.parseUrl(url).hostname)) {
                    NativeApp.openURLInDefaultBrowser(url);
                }
            }
        });
    }
    
    /**
     * Check for updates. If "force" is true, update notification dialogs are always displayed 
     * (if an update is available). If "force" is false, the update notification is only 
     * displayed for newly available updates.
     * 
     * If an update is available, show the "update available" notification icon in the title bar.
     *
     * @param {boolean} force If true, always show the notification dialog.
     * @param {Object} _testValues This should only be used for testing purposes. See comments for details.
     * @return {$.Promise} jQuery Promise object that is resolved or rejected after the update check is complete.
     */
    function checkForUpdate(force, _testValues) {
        // The second param, if non-null, is an Object containing value overrides. Values
        // in the object temporarily override the local values. This should *only* be used for testing.
        // If any overrides are set, permanent changes are not made (including showing
        // the update notification icon and saving prefs).
        var oldValues;
        var usingOverrides = false; // true if any of the values are overridden.
        var result = new $.Deferred();
        
        if (_testValues) {
            oldValues = {};
            
            if (_testValues.hasOwnProperty("_buildNumber")) {
                oldValues._buildNumber = _buildNumber;
                _buildNumber = _testValues._buildNumber;
                usingOverrides = true;
            }

            if (_testValues.hasOwnProperty("_lastNotifiedBuildNumber")) {
                oldValues._lastNotifiedBuildNumber = _lastNotifiedBuildNumber;
                _lastNotifiedBuildNumber = _testValues._lastNotifiedBuildNumber;
                usingOverrides = true;
            }

            if (_testValues.hasOwnProperty("_versionInfoURL")) {
                oldValues._versionInfoURL = _versionInfoURL;
                _versionInfoURL = _testValues._versionInfoURL;
                usingOverrides = true;
            }
            
            if (_testValues.hasOwnProperty("_lastInfoURLFetchTime")) {
                oldValues._lastInfoURLFetchTime = _lastInfoURLFetchTime;
                _lastInfoURLFetchTime = _testValues._lastInfoURLFetchTime;
                usingOverrides = true;
            }
            
            if (_testValues.hasOwnProperty("_lastUsageReportTime")) {
                oldValues._lastUsageReportTime = _lastUsageReportTime;
                _lastUsageReportTime = _testValues._lastUsageReportTime;
                usingOverrides = true;
            }
        }
        
        _getUpdateInformation(force || usingOverrides, !usingOverrides)
            .done(function (versionInfo) {
                // Get all available updates
                var allUpdates = _stripOldVersionInfo(versionInfo, _buildNumber);
                
                // When running directly from GitHub source (as opposed to 
                // an installed build), _buildNumber is 0. In this case, if the
                // test is not forced, don't show the update notification icon or
                // dialog.
                if (_buildNumber === 0 && !force) {
                    result.resolve();
                    return;
                }
                
                if (allUpdates) {
                    // Always show the "update available" icon if any updates are available
                    var $updateNotification = $("#update-notification");
                    
                    $updateNotification.css("display", "inline-block");
                    if (!_addedClickHandler) {
                        _addedClickHandler = true;
                        $updateNotification.on("click", function () {
                            checkForUpdate(true);
                        });
                    }
                
                    // Only show the update dialog if force = true, or if the user hasn't been 
                    // alerted of this update
                    if (force || allUpdates[0].buildNumber >  _lastNotifiedBuildNumber) {
                        _showUpdateNotificationDialog(allUpdates);
                        
                        // Update prefs with the last notified build number
                        _lastNotifiedBuildNumber = allUpdates[0].buildNumber;
                        // Don't save prefs is we have overridden values
                        if (!usingOverrides) {
                            _prefs.setValue("lastNotifiedBuildNumber", _lastNotifiedBuildNumber);
                        }
                    }
                } else if (force) {
                    // No updates are available. If force == true, let the user know.
                    Dialogs.showModalDialog(
                        DefaultDialogs.DIALOG_ID_ERROR,
                        Strings.NO_UPDATE_TITLE,
                        Strings.NO_UPDATE_MESSAGE
                    );
                }
        
                if (oldValues) {
                    if (oldValues.hasOwnProperty("_buildNumber")) {
                        _buildNumber = oldValues._buildNumber;
                    }
                    if (oldValues.hasOwnProperty("_lastNotifiedBuildNumber")) {
                        _lastNotifiedBuildNumber = oldValues._lastNotifiedBuildNumber;
                    }
                    if (oldValues.hasOwnProperty("_versionInfoURL")) {
                        _versionInfoURL = oldValues._versionInfoURL;
                    }
                    if (oldValues.hasOwnProperty("_lastInfoURLFetchTime")) {
                        _lastInfoURLFetchTime = oldValues._lastInfoURLFetchTime;
                    }
                    if (oldValues.hasOwnProperty("_lastUsageReportTime")) {
                        _lastUsageReportTime = oldValues._lastUsageReportTime;
                    }
                }
                result.resolve();
            })
            .fail(function () {
                // Error fetching the update data. If this is a forced check, alert the user
                if (force) {
                    Dialogs.showModalDialog(
                        DefaultDialogs.DIALOG_ID_ERROR,
                        Strings.ERROR_FETCHING_UPDATE_INFO_TITLE,
                        Strings.ERROR_FETCHING_UPDATE_INFO_MSG
                    );
                }
                result.reject();
            });
        
        return result.promise();
    }
    
    // Append locale to version info URL
    _versionInfoURL = Urls.UPDATE_INFO_URL + ".json";
    
    // Define public API
    exports.checkForUpdate = checkForUpdate;
    
    // for unit tests only
    exports._lastRequest = _lastRequest;
});
