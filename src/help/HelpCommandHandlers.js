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


/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window, PathUtils, Mustache */

define(function (require, exports, module) {
    "use strict";
    
    var AppInit                 = require("utils/AppInit"),
        Global                  = require("utils/Global"),
        BuildInfoUtils          = require("utils/BuildInfoUtils"),
        Commands                = require("command/Commands"),
        CommandManager          = require("command/CommandManager"),
        Dialogs                 = require("widgets/Dialogs"),
        Strings                 = require("strings"),
        UpdateNotification      = require("utils/UpdateNotification"),
        FileUtils               = require("file/FileUtils"),
        NativeApp               = require("utils/NativeApp"),
        StringUtils             = require("utils/StringUtils"),
        AboutDialogTemplate     = require("text!htmlContent/about-dialog.html"),
        ContributorsTemplate    = require("text!htmlContent/contributors-list.html"),
        Urls                    = require("i18n!nls/urls");
    
    var buildInfo;
    
	
    function _handleCheckForUpdates() {
        UpdateNotification.checkForUpdate(true);
    }
    
    function _handleLinkMenuItem(url) {
        return function () {
            if (!url) {
                return;
            }
            NativeApp.openURLInDefaultBrowser(url);
        };
    }
    
    function _handleShowExtensionsFolder() {
        brackets.app.showExtensionsFolder(
            FileUtils.convertToNativePath(decodeURI(window.location.href)),
            function (err) {} /* Ignore errors */
        );
    }

    function _handleAboutDialog() {
        var templateVars = {
            ABOUT_ICON          : brackets.config.about_icon,
            APP_NAME_ABOUT_BOX  : brackets.config.app_name_about,
            BUILD_INFO          : buildInfo || "",
            Strings             : Strings
        };
        
        Dialogs.showModalDialogUsingTemplate(Mustache.render(AboutDialogTemplate, templateVars));
        
        // Get containers
        var $dlg = $(".about-dialog.instance"),
            $contributors = $dlg.find(".about-contributors"),
            $spinner = $dlg.find(".spinner");
        
        $spinner.addClass("spin");
        
        // Get all the project contributors and add them to the dialog
        $.getJSON(brackets.config.contributors_url).done(function (contributorsInfo) {
            
            // Populate the contributors data
            var totalContributors = contributorsInfo.length;
            var contributorsCount = 0;
            
            $contributors.html(Mustache.render(ContributorsTemplate, contributorsInfo));
            
            // This is used to create an opacity transition when each image is loaded
            $contributors.find("img").one("load", function () {
                $(this).css("opacity", 1);
                
                // Count the contributors loaded and hide the spinner once all are loaded
                contributorsCount++;
                if (contributorsCount >= totalContributors) {
                    $spinner.removeClass("spin");
                }
            }).each(function () {
                if (this.complete) {
                    $(this).trigger("load");
                }
            });
            
            // Create a link for each contributor image to their github account
            $contributors.on("click", "img", function (e) {
                var url = $(e.target).data("url");
                if (url) {
                    // Make sure the URL has a domain that we know about
                    if (/(^|\.)github\.com$/i.test(PathUtils.parseUrl(url).hostname)) {
                        NativeApp.openURLInDefaultBrowser(url);
                    }
                }
            });
        }).fail(function () {
            $spinner.removeClass("spin");
            $contributors.html(Mustache.render("<p class='dialog-message'>{{ABOUT_TEXT_LINE6}}</p>", Strings));
        });
    }

    // Read "build number" SHAs off disk immediately at APP_READY, instead
    // of later, when they may have been updated to a different version
    AppInit.appReady(function () {
        BuildInfoUtils.getBracketsSHA().done(function (branch, sha, isRepo) {
            // If we've successfully determined a "build number" via .git metadata, add it to dialog
            sha = sha ? sha.substr(0, 9) : "";
            if (branch || sha) {
                buildInfo = StringUtils.format("({0} {1})", branch, sha).trim();
            }
        });
    });
    
    var _releaseNotesURL = Urls.RELEASE_NOTES_URL;

    CommandManager.register(Strings.CMD_CHECK_FOR_UPDATE,       Commands.HELP_CHECK_FOR_UPDATE,     _handleCheckForUpdates);
    CommandManager.register(Strings.CMD_HOW_TO_USE_BRACKETS,    Commands.HELP_HOW_TO_USE_BRACKETS,  _handleLinkMenuItem(brackets.config.how_to_use_url));
    CommandManager.register(Strings.CMD_FORUM,                  Commands.HELP_FORUM,                _handleLinkMenuItem(brackets.config.forum_url));
    CommandManager.register(Strings.CMD_RELEASE_NOTES,          Commands.HELP_RELEASE_NOTES,        _handleLinkMenuItem(_releaseNotesURL));
    CommandManager.register(Strings.CMD_REPORT_AN_ISSUE,        Commands.HELP_REPORT_AN_ISSUE,      _handleLinkMenuItem(brackets.config.report_issue_url));
    CommandManager.register(Strings.CMD_SHOW_EXTENSIONS_FOLDER, Commands.HELP_SHOW_EXT_FOLDER,      _handleShowExtensionsFolder);
    CommandManager.register(Strings.CMD_TWITTER,                Commands.HELP_TWITTER,              _handleLinkMenuItem(brackets.config.twitter_url));
    CommandManager.register(Strings.CMD_ABOUT,                  Commands.HELP_ABOUT,                _handleAboutDialog);
});
