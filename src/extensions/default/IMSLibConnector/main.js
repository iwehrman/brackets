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
/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";

    // Brackets modules
    var AppInit = brackets.getModule("utils/AppInit");

    var authorizedUserInfoCache = {},
        promiseCache = {};

    var IMS_NO_ERROR = 0,
        IMSLIB_CALL_PENDING = 11;

    function invalidateCache() {
        delete authorizedUserInfoCache.authorizedUser;
        delete authorizedUserInfoCache.expirationDate;
    }

    function saveAuthorizedUserInCache(authorizedUserProfile, expirationDate) {
        authorizedUserInfoCache.authorizedUser = authorizedUserProfile;
        authorizedUserInfoCache.expirationDate = expirationDate;
    }

    function getAuthorizedUserFromCache() {
        if (authorizedUserInfoCache.authorizedUser) {
            if (Date.now() < authorizedUserInfoCache.expirationDate) {
                return authorizedUserInfoCache.authorizedUser;
            } else {
                invalidateCache();
            }
        } else {
            return undefined;
        }
    }

    function removeAuthorizationRelatedInformation(userProfileJson) {
        try {
            // make shallow copy. This works only with key value pairs where
            // the value is not a function
            var modifiedUserProfileJson = JSON.parse(JSON.stringify(userProfileJson));

            delete modifiedUserProfileJson.access_token;
            delete modifiedUserProfileJson.expires_in;
            delete modifiedUserProfileJson.refresh_token;
            delete modifiedUserProfileJson.token_type;

            return modifiedUserProfileJson;
        } catch (error) {
            console.error(error);

            // TODO: what to return in error case? The original function argument?
            return {};
        }
    }

    function _getAuthorizedUser() {
        function getAuthorizedUser(deferred) {
            var result = deferred || new $.Deferred();

            brackets.app.getAuthorizedUser(function (err, status) {
                if (err === IMS_NO_ERROR) {
                    try {
                        var userProfileJson = JSON.parse(status);

                        // expiration date for cached user profile data
                        var expirationDate = Date.now() + userProfileJson.expires_in;
                        var userProfileCopyJson = JSON.parse(status);
                        saveAuthorizedUserInCache(userProfileCopyJson, expirationDate);

                        result.resolve(removeAuthorizationRelatedInformation(userProfileJson));
                    } catch (error) {
                        console.error(error);
                        result.reject(error);
                    }
                } else {
                    result.reject(err);
                }
            });

            return result.promise();
        }

        function retryUntilSuccess(f) {
            return f().then(
                undefined,
                function (err) {
                    if (err === IMSLIB_CALL_PENDING) {
                        return retryUntilSuccess(f); // recurse
                    } else {
                        return err;
                    }
                }
            );
        }

        var authorizedUser = getAuthorizedUserFromCache();

        if (authorizedUser) {
            return $.Deferred().resolve(removeAuthorizationRelatedInformation(authorizedUser)).promise();
        } else {
            return retryUntilSuccess(getAuthorizedUser);
        }

//            var promise = promiseCache.activePromise;
//
//            if (promise) {
//                return promise;
//            } else {
//                promise = getAuthorizedUser();
//                promiseCache.activePromise = promise;
//
//                // remove cached promise
//                promise.always(function () {
//                    delete promiseCache.activePromise;
//                });
//
//                return promise;
//            }
//        }
    }

    function _getAccessToken() {
        function getAccessToken() {
            var result = new $.Deferred();

            _getAuthorizedUser().done(function (userProfile) {
                var authorizedUser = getAuthorizedUserFromCache();
                result.resolve(authorizedUser.access_token);
            }).fail(function (err) {
                result.reject(err);
            });

            return result.promise();
        }

        var authorizedUser = getAuthorizedUserFromCache();

        if (authorizedUser && authorizedUser.access_token) {
            return $.Deferred().resolve(authorizedUser.access_token).promise();
        } else {
            return getAccessToken();
        }
    }

    // warm up
    _getAuthorizedUser();

    // Once this Extension has been loaded, the functions will be registered in the global object
    brackets.authentication = {};
    brackets.authentication.getAccessToken    = _getAccessToken;
    brackets.authentication.getAuthorizedUser = _getAuthorizedUser;

    // for unit testing only
    exports._invalidateCache                  = invalidateCache;
});
