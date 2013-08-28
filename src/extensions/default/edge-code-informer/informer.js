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


/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, Mustache */

define(function (require, exports, module) {
    "use strict";
    
    var INFORMER_MAX_RETRIES        = 5,
        INFORMER_INITIAL_DELAY      = 1000,      // one second
        INFORMER_HTTP_TIMEOUT       = 1000 * 10, // ten seconds
        INFORMER_BASE_URL           = "http://feedback.informer.io",
        INFORMER_STATUS_URL         = INFORMER_BASE_URL + "/status/",
        INFORMER_FEEDBACK_URL       = INFORMER_BASE_URL + "/feedback/",
        INFORMER_API_KEY            = "yu3v1yxyef",
        INFORMER_STATUS_DATA        = {
            apikey: INFORMER_API_KEY,
            userAgentString: window.navigator.userAgent
        };
    
    /**
     * Post the given feedback text to the Informer service.
     *
     * @param {string} feedbackText - the feedback text to be posted
     * @return {jQuery.Promise} - Resolves if the post was successful; rejects otherwise.
     */
    function postFeedback(feedbackText) {
        var retryDelay = INFORMER_INITIAL_DELAY,
            deferred = $.Deferred(),
            date = new Date().toGMTString(),
            feedbackData = {
                product: {
                    version : brackets.metadata.version,
                    apikey  : INFORMER_API_KEY
                },
                user: {
                    name: "anonymous",
                    isAnonymous: true
                },
                feedback: feedbackText,
                feedbackContext: {
                    userAgentString: window.navigator.userAgent,
                    created_at: date
                }
            };
        
        function feedbackHelper(count) {
            if (count < INFORMER_MAX_RETRIES) {
                $.ajax({
                    type     : "POST",
                    dataType : "json",
                    url      : INFORMER_FEEDBACK_URL,
                    data     : feedbackData
                }).fail(function () {
                    setTimeout(function () {
                        feedbackHelper(++count);
                    }, retryDelay);
                    retryDelay *= 2;
                }).done(function () {
                    deferred.resolve();
                });
            } else {
                deferred.reject();
            }
        }

        if (window.navigator.onLine) {
            feedbackHelper(0);
        } else {
            deferred.reject();
        }
        
        return deferred.promise();
    }
    
    /**
     * Asynchronously get the status of the Informer service.
     *
     * @return {jQuery.Promise} - Resolves if the service is online; rejects otherwise.
     */
    function getStatus() {
        var retryDelay = INFORMER_INITIAL_DELAY,
            deferred = $.Deferred();
        
        function statusHelper(count) {
            if (count < INFORMER_MAX_RETRIES) {
                $.ajax({
                    type     : "GET",
                    dataType : "json",
                    data     : INFORMER_STATUS_DATA,
                    url      : INFORMER_STATUS_URL,
                    timeout  : INFORMER_HTTP_TIMEOUT
                }).done(function (data) {
                    deferred.resolve();
                }).fail(function () {
                    setTimeout(function () {
                        statusHelper(++count);
                    }, retryDelay);
                    retryDelay *= 2;
                });
            } else {
                deferred.reject();
            }
        }
        
        if (window.navigator.onLine) {
            statusHelper(0, retryDelay);
        } else {
            deferred.reject();
        }
        
        return deferred.promise();
    }

    exports.getStatus = getStatus;
    exports.postFeedback = postFeedback;
});
