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
    var CCManager = brackets.getModule("creativecloud/CCManager"),
        AppInit   = brackets.getModule("utils/AppInit");

    function IMSConnector() {
    }

    // This is the implementation of the Interface
    IMSConnector.prototype.getAuthorizedUser = function () {
        var result = new $.Deferred();

        brackets.app.getAuthorizedUser(function (err, status) {
            if (err === 0) {
                // remove all authentication related information from the json object
                var userProfileJson = JSON.parse(status);

                delete userProfileJson.access_token;
                delete userProfileJson.expires_in;
                delete userProfileJson.refresh_token;
                delete userProfileJson.token_type;

                result.resolve(userProfileJson);
            } else {
                result.reject(err);
            }
        });

        return result.promise();
    };

    IMSConnector.prototype.getAccessToken = function () {
        var result = new $.Deferred();

        brackets.app.getAuthorizedUser(function (err, status) {
            if (err === 0) {
                // extract only the access_token from the json object
                result.resolve(JSON.parse(status).access_token);
            } else {
                result.reject(err);
            }
        });

        return result.promise();
    };

    // version of the Interface
    IMSConnector.prototype.version = "1.0";

    // Once the App has been started, the Creative Cloud Connector will be registered.
    AppInit.appReady(function () {
        CCManager.registerCreativeCloudConnector(new IMSConnector());
    });
});
