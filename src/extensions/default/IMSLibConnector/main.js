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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window */

define(function (require, exports, module) {
    "use strict";

    // Brackets modules
    var AppInit = brackets.getModule("utils/AppInit");
    
    // error codes from the shell
    var IMS_NO_ERROR = 0,
        IMS_ERR_CALL_PENDING = 11;

    // max retries when the error shell error is CALL_PENDING
    var MAX_RETRIES = 10,
        MS_WAIT_UNTIL_RETRY = 100,
        MS_TIMEOUT = 2000;

    // cached authorization status from the shell
    var authStatusCache = null,
        authStatusDeferred = null,
        authStatusTimer = null;

    /**
     * Clear cached auth status information
     */
    function _invalidateCache() {
        authStatusCache = null;
        authStatusTimer = null;
    }

    /**
     * Make an authorized user object from the status object returned from the
     * shell. For now just strips the access token-related information from the
     * status object.
     * 
     * @param {Object} status - IMSLib status object
     * @return {Object} - authorized user object
     */
    function getAuthorizedUserFromStatus(status) {
        // make shallow copy. This works only with key value pairs where
        // the value is not a function
        var modifiedUserProfileJson = JSON.parse(JSON.stringify(status));

        delete modifiedUserProfileJson.access_token;
        delete modifiedUserProfileJson.expires_in;
        delete modifiedUserProfileJson.refresh_token;
        delete modifiedUserProfileJson.token_type;

        return modifiedUserProfileJson;
    }
    
    /**
     * Asynchronously get an authStatus object, either from the cache or from the shell.
     *
     * @param {boolean} forceRefresh - if set, ignore the cached status and force a refresh
     * @returns {$.Promise<{accessToken: string, authorizedUser: Object}>} - an auth status object
     */
    function _getAuthStatus(forceRefresh) {
        var deferred,
            deferredTimer;
        
        // wrap the callback in a function so it can be called recursively
        function getAuthStatusHelper(retryCount) {
            if (deferred.state() !== "pending") {
                return;
            }
            
            if (retryCount === undefined) {
                retryCount = 0;
            }
            
            if (retryCount >= MAX_RETRIES) {
                deferred.reject();
            } else {
                brackets.app.getAuthorizedUser(function (err, status) {
                    if (deferred.state() !== "pending") {
                        return;
                    }
                    
                    if (err === IMS_NO_ERROR) {
                        try {
                            var statusObj = JSON.parse(status),
                                accessToken = statusObj.access_token,
                                authorizedUser = getAuthorizedUserFromStatus(statusObj),
                                expiresIn = statusObj.expires_in;

                            // cache the auth status
                            authStatusCache = {
                                accessToken: accessToken,
                                authorizedUser: authorizedUser
                            };
                            
                            // invalidate and refresh the cached status once the token expires
                            authStatusTimer = window.setTimeout(function () {
                                _invalidateCache();
                                _getAuthStatus();
                            }, expiresIn);
                            
                            deferred.resolve(authStatusCache);
                        } catch (parseError) {
                            console.error("Unable to parse auth status: ", parseError);
                            deferred.reject(parseError);
                        }
                    } else if (err === IMS_ERR_CALL_PENDING) {
                        window.setTimeout(function () {
                            getAuthStatusHelper(++retryCount);
                        }, MS_WAIT_UNTIL_RETRY);
                    } else {
                        deferred.reject(err);
                    }
                });
            }
        }
        
        // if a request to the shell is already in progress, return the existing
        // promise for that request; otherwise, make a new request
        if (authStatusDeferred) {
            deferred = authStatusDeferred;
        } else {
            deferred = $.Deferred();
            
            // if the deferred isn't resolved in time, reject it
            deferredTimer = window.setTimeout(function () {
                deferred.reject("IMSLib timeout");
            }, MS_TIMEOUT);
            
            // clear the timer as soon as the deferred is resolved or rejected
            deferred.always(function () {
                window.clearTimeout(deferredTimer);
            });
            
            // if there is no cached status, we'll request it from the shell and
            // cache the promise so that there is at most one active callback
            if (!authStatusCache) {
                authStatusDeferred = deferred;
            }
            
            // request status information from the shell if either there is no
            // cached status or if a refresh has been forced; otherwise immediately
            // resolve with the cached information
            if (!authStatusCache || forceRefresh) {
                // request new authStatus from IMSLib
                getAuthStatusHelper();
                
                // clear the cached promise once the request is complete
                deferred.always(function () {
                    authStatusDeferred = null;
                });

            } else {
                deferred.resolve(authStatusCache);
            }
        }
        
        return deferred.promise();
    }

    /**
     * Get an authorizedUser object for the currently logged in user
     * 
     * @return {$.Promise<Object>} - a promise that resolves to an authorizedUser
     */
    function getAuthorizedUser(force) {
        var deferred = $.Deferred();
        
        _getAuthStatus(force).done(function (status) {
            deferred.resolve(status.authorizedUser);
        }).fail(function (err) {
            deferred.reject(err);
        });
        
        return deferred.promise();
    }
    
    /**
     * Get an access token for the currently logged in user
     * 
     * @return {$.Promise<string>} - A promise that resolves to an access token
     */
    function getAccessToken(force) {
        var deferred = $.Deferred();
        
        _getAuthStatus(force).done(function (status) {
            deferred.resolve(status.accessToken);
        }).fail(function (err) {
            deferred.reject(err);
        });

        return deferred.promise();
    }

    AppInit.appReady(function () {
        // warm up the status cache
        _getAuthStatus();
        
        // refresh the cache after the window receives focus
        window.addEventListener("focus", function () {
            if (authStatusTimer) {
                window.clearTimeout(authStatusTimer);
            }
            // force a refresh, but only clear the cached status once the new
            // status is ready
            _getAuthStatus(true);
        });
    });

    // Once this Extension has been loaded, the functions will be registered in the global object
    brackets.authentication = {};
    brackets.authentication.getAccessToken    = getAccessToken;
    brackets.authentication.getAuthorizedUser = getAuthorizedUser;

    // for unit testing only
    exports._invalidateCache    = _invalidateCache;
    exports._getAuthStatus      = _getAuthStatus;
});
