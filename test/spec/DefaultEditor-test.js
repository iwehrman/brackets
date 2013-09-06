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


/*jslint vars: true, plusplus: true, devel: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, describe, it, runs, expect, brackets, beforeFirst, afterEach, afterLast, waitsForDone, spyOn */

define(function (require, exports, module) {
    'use strict';
    
    // Load dependent modules
    var DefaultEditor,
        jquery,
        SpecRunnerUtils = require("spec/SpecRunnerUtils");
    
    describe("DefaultEditor", function () {
        this.category = "integration";
        
        var testWindow,
            fakeIsDefault       = false,
            FILEEXT_TESTTYPE    = ".atest";
        
        beforeFirst(function () {
            SpecRunnerUtils.createTestWindowAndRun(this, function (w) {
                testWindow      = w;
                
                // Load module instances from brackets.test
                DefaultEditor   = testWindow.brackets.test.DefaultEditor;
                jquery          = testWindow.$;
            });
        });
        
        afterLast(function () {
            testWindow      = null;
            DefaultEditor   = null;
            jquery          = null;
            SpecRunnerUtils.closeTestWindow();
        });
        
        describe("Default Editor", function () {
            
            it("should register app as default editor for test file extension", function () {
                var isDefault = false;
                 
                spyOn(testWindow.brackets.app, 'registerAsDefaultEditorFor').andCallFake(function (fileExt, callback) {
                    fakeIsDefault = (brackets.platform === "win");  // fake register as default on Windows
                    callback(testWindow.brackets.app.NO_ERROR);
                });
    
                spyOn(testWindow.brackets.app, 'checkIfDefaultEditorFor').andCallFake(function (fileExt, callback) {
                    callback(testWindow.brackets.app.NO_ERROR, fakeIsDefault);
                });
    
                runs(function () {
                    var promise = DefaultEditor.registerAsDefaultEditorFor(FILEEXT_TESTTYPE);
                    waitsForDone(promise, "register as default");
                });
                
                runs(function () {
                    var promise = DefaultEditor.checkIfDefaultEditorFor(FILEEXT_TESTTYPE);
                    promise.done(function (result) {
                        isDefault = result;
                    });
                    waitsForDone(promise, "check if default");
                });
                
                runs(function () {
                    if (brackets.platform === "win") {
                        expect(isDefault).toBeTruthy();
                    } else {
                        expect(isDefault).toBeFalsy();
                    }
                });
            });

            it("should unregister app as default editor for test file extension", function () {
                var isDefault = false;
                 
                spyOn(testWindow.brackets.app, 'unregisterAsDefaultEditorFor').andCallFake(function (fileExt, callback) {
                    fakeIsDefault = false;  // fake unregister as default
                    callback(testWindow.brackets.app.NO_ERROR);
                });
    
                spyOn(testWindow.brackets.app, 'checkIfDefaultEditorFor').andCallFake(function (fileExt, callback) {
                    callback(testWindow.brackets.app.NO_ERROR, fakeIsDefault);
                });
                
                runs(function () {
                    var promise = DefaultEditor.unregisterAsDefaultEditorFor(FILEEXT_TESTTYPE);
                    waitsForDone(promise, "unregister as default");
                });
                
                runs(function () {
                    var promise = DefaultEditor.checkIfDefaultEditorFor(FILEEXT_TESTTYPE);
                    promise.done(function (result) {
                        isDefault = result;
                    });
                    waitsForDone(promise, "check if default");
                });
                
                runs(function () {
                    expect(isDefault).toBeFalsy();
                });
            });
            
        });
    });
});
