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


/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $ */

define(function (require, exports, module) {
    "use strict";
    
    var Directory       = require("filesystem/Directory"),
        File            = require("filesystem/File"),
        FileIndex       = require("filesystem/FileIndex"),
        InMemoryFile    = require("filesystem/InMemoryFile");
    
    
    /**
     * Constructor. FileSystem objects should not be constructed directly.
     * Use FileSystemManager.createFileSystem() instead.
     * @param {!FileSystemImpl} impl Low-level file system implementation to use.
     */
    function FileSystem(impl) {
        this._impl = impl;
        this._impl.init();
        
        // Create a file index
        this._index = new FileIndex();
    }
    
    /**
     * The low-level file system implementation used by this object. 
     * This is set in the constructor and cannot be changed.
     */
    FileSystem.prototype._impl = null;
    
    /**
     * The FileIndex used by this object. This is initialized in the constructor.
     */
    FileSystem.prototype._index = null;
    
    /**
     * Close a file system. Clear all caches, indexes, and file watchers.
     */
    FileSystem.prototype.close = function () {
        this._impl.unwatchAll();
        this._index.clear();
    };
    
    /**
     * Returns false for files and directories that are not commonly useful to display.
     *
     * @param {string} path File or directory to filter
     * @return boolean true if the file should be displayed
     */
    var _exclusionListRegEx = /\.pyc$|^\.git$|^\.gitignore$|^\.gitmodules$|^\.svn$|^\.DS_Store$|^Thumbs\.db$|^\.hg$|^CVS$|^\.cvsignore$|^\.gitattributes$|^\.hgtags$|^\.hgignore$/;
    // IAN-FS: it seems like this exclusion should be at a higher abstraction layer; e.g., the file tree
    FileSystem.prototype.shouldShow = function (path) {
        var name = path.substr(path.lastIndexOf("/") + 1);
        
        return !name.match(_exclusionListRegEx);
    };
    
    /**
     * Return a File object for the specified path.
     *
     * @param {string} path Path of file. 
     *
     * @return {File} The File object. This file may not yet exist on disk.
     */
    FileSystem.prototype.getFileForPath = function (path) {
        var file = this._index.getEntry(path);
        
        if (!file) {
            file = new File(path, this._impl);
            this._index.addEntry(file);
        }
                
        return file;
    };
     
    /**
     * Return an File object that does *not* exist on disk. Any attempts to write to this
     * file will result in a Save As dialog. Any attempt to read will fail.
     *
     * @return {File} The File object.
     */
    FileSystem.prototype.getInMemoryFile = function (path) {
        var file = new InMemoryFile(path, this._impl);
        
        // TODO: Add to index?
        
        return file;
    };
    
    /**
     * Return a Directory object for the specified path.
     *
     * @param {string} path Path of directory. Pass NULL to get the root directory.
     *
     * @return {Directory} The Directory object. This directory may not yet exist on disk.
     */
    FileSystem.prototype.getDirectoryForPath = function (path) {
        // Make sure path doesn't include trailing slash
        if (path[path.length - 1] === "/") {
            path = path.substr(0, path.length - 1);
        }
        
        var directory = this._index.getEntry(path);
        
        if (!directory) {
            directory = new Directory(path, this._impl);
            this._index.addEntry(directory);
        }
        
        return directory;
    };
    
    /**
     * Check if the specified path exists.
     *
     * @param {string} path The path to test
     * @return {$.Promise} Promise that is resolved if the path exists, or rejected if it doesn't.
     */
    FileSystem.prototype.pathExists = function (path) {
        var result = new $.Deferred();
        
        this._impl.exists(path, function (exists) {
            if (exists) {
                // TODO FileSystem ---- IAN-FS: is path guaranteed to exist in the index at this point?
                result.resolve(this._index.getEntry(path));
            } else {
                result.reject();
            }
        }.bind(this));
        
        return result.promise();
    };
    
    /**
     * Resolve a path.
     *
     * @param {string} path The path to resolve
     * @return {$.Promise} Promise that is resolved with a File or Directory object, if it exists,
     *     or rejected if there is an error.
     */
    FileSystem.prototype.resolve = function (path) {
        var result = new $.Deferred();
        
        this.pathExists(path)
            .done(function () {
                this._impl.stat(path, function (err, stat) {
                    var item;
                    
                    if (err) {
                        result.reject(err);
                        return;
                    }
                    if (stat.isFile()) {
                        item = this.getFileForPath(path);
                    } else {
                        item = this.getDirectoryForPath(path);
                    }
                    result.resolve(item);
                }.bind(this));
            }.bind(this))
            .fail(function () {
                result.reject();
            });
        
        return result.promise();
    };
    
    /**
     * Read the contents of a Directory. 
     *
     * @param {Directory} directory Directory whose contents you want to get
     *
     * @return {$.Promise} Promise that is resolved with the contents of the directory.
     *         Contents is an Array of File and Directory objects.
     */
    FileSystem.prototype.getDirectoryContents = function (directory) {
        var i, entryPath, entry, result = new $.Deferred();
        
        // IAN-FS: when caching promises, we need to ensure that the promise will eventually resolve or reject
        if (directory._contentsPromise) {
            // Existing promise for this directory's contents. Return it.
            return directory._contentsPromise;
        }
        
        if (directory._contents) {
            // Return cached directory contents
            result.resolve(directory._contents);
            return result.promise();
        }
        
        this._impl.readdir(directory.fullPath, function (err, contents, stats) {
            directory._contents = [];
            
            // Instantiate content objects
            var len = stats ? stats.length : 0;
            
            for (i = 0; i < len; i++) {
                entryPath = directory.fullPath + "/" + contents[i];
                
                if (this.shouldShow(entryPath)) {
                    if (stats[i].isFile()) {
                        entry = this.getFileForPath(entryPath);
                    } else {
                        entry = this.getDirectoryForPath(entryPath);
                    }
                    
                    directory._contents.push(entry);
                }
            }
            
            directory._contentsPromise = null;
            result.resolve(directory._contents);
        }.bind(this));
        
        directory._contentsPromise = result.promise();
        
        return result.promise();
    };
    
    /**
     * Return all indexed files, with optional filtering
     *
     * @param {=function (entry):boolean} filterFunc Optional filter function. If supplied,
     *         this function is called for all entries. Return true to keep this entry,
     *         or false to omit it.
     *
     * @return {Array<File>} Array containing all indexed files.
     */
    FileSystem.prototype.getFileList = function (filterFunc) {
        var result = this._index.getAllFiles();
        
        if (filterFunc) {
            return result.filter(filterFunc);
        }
        
        return result;
    };
    
    /**
     * Show an "Open" dialog and return the file(s)/directories selected by the user.
     *
     * @param {boolean} allowMultipleSelection Allows selecting more than one file at a time
     * @param {boolean} chooseDirectories Allows directories to be opened
     * @param {string} title The title of the dialog
     * @param {string} initialPath The folder opened inside the window initially. If initialPath
     *                          is not set, or it doesn't exist, the window would show the last
     *                          browsed folder depending on the OS preferences
     * @param {Array.<string>} fileTypes List of extensions that are allowed to be opened. A null value
     *                          allows any extension to be selected.
     *
     * @return {$.Promise} Promise that will be resolved with the selected file(s)/directories, 
     *                     or rejected if an error occurred.
     */
    FileSystem.prototype.showOpenDialog = function (allowMultipleSelection,
                            chooseDirectories,
                            title,
                            initialPath,
                            fileTypes) {
        
        var result = new $.Deferred();
        
        this._impl.showOpenDialog(allowMultipleSelection, chooseDirectories, title, initialPath, fileTypes, function (err, data) {
            if (err) {
                result.reject(err);
            } else {
                result.resolve(data);
            }
        });
        
        return result.promise();
    };
    
    /**
     * Show a "Save" dialog and return the path of the file to save.
     *
     * @param {string} title The title of the dialog.
     * @param {string} initialPath The folder opened inside the window initially. If initialPath
     *                          is not set, or it doesn't exist, the window would show the last
     *                          browsed folder depending on the OS preferences.
     * @param {string} proposedNewFilename Provide a new file name for the user. This could be based on
     *                          on the current file name plus an additional suffix
     *
     * @return {$.Promise} Promise that will be resolved with the name of the file to save,
     *                     or rejected if an error occurred.
     */
    FileSystem.prototype.showSaveDialog = function (title, initialPath, proposedNewFilename) {
        var result = new $.Deferred();
        
        this._impl.showSaveDialog(title, initialPath, proposedNewFilename, function (err, selection) {
            if (err) {
                result.reject(err);
            } else {
                result.resolve(selection);
            }
        });
        
        return result.promise();
    };
    
    /**
     * @private
     * Recursively scan and index all entries in a directory
     */
    FileSystem.prototype._scanDirectory = function (directoryPath) {
        var directory = this.getDirectoryForPath(directoryPath);
        
        // IAN-FS: this won't terminate if there is a symlink to a parent directory
        this.getDirectoryContents(directory).done(function (entries) {
            var i;
            
            for (i = 0; i < entries.length; i++) {
                if (entries[i].isDirectory()) {
                    this._scanDirectory(entries[i].fullPath);
                }
            }
        }.bind(this));
        this._impl.watchPath(directoryPath);
        
        // TODO FileSystem ---- IAN-FS: this should return a promise
    };
    
    /**
     * @private
     * Callback for file/directory watchers. This is called by the low-level implementation
     * whenever a directory or file is changed. 
     *
     * @param {string} path The path that changed. This could be a file or a directory.
     * @param {stat=} stat Optional stat for the item that changed. This param is not always
     *         passed. 
     */
    FileSystem.prototype._watcherCallback = function (path, stat) {
        if (!this._index) {
            return;
        }
        
        var entry = this._index.getEntry(path);
        
        if (entry) {
            if (entry.isFile()) {
                // Update stat and clear contents, but only if out of date
                if (!stat || !entry._stat || (stat.mtime !== entry._stat.mtime)) {
                    entry._stat = stat;
                    entry._contents = undefined;
                }
            } else {
                var oldContents = entry._contents,  // TODO: Handle pending content promise
                    self = this;
                
                // Clear out old contents
                entry._contents = entry._contentsPromise = undefined;
                
                // Read new contents
                this.getDirectoryContents(entry)
                    .done(function (contents) {
                        var i, len, item, path;
                        
                        function _isInPath(item) {
                            return item.fullPath.indexOf(path) === 0;
                        }
                        
                        // Check for deleted entries 
                        len = oldContents ? oldContents.length : 0;
                        for (i = 0; i < len; i++) {
                            item = oldContents[i];
                            if (contents.indexOf(item) === -1) {
                                if (item.isFile()) {
                                    // File removed, just remove from index.
                                    self._index.removeEntry(item);
                                } else {
                                    // Remove the directory and all entries under it
                                    path = item.fullPath;
                                    var j, itemsToDelete = self.getFileList(_isInPath);
                                    
                                    for (j = 0; j < itemsToDelete.length; j++) {
                                        self._index.removeEntry(itemsToDelete[j]);
                                    }
                                    
                                    self._index.removeEntry(item);
                                    self._impl.unwatchPath(item.fullPath);
                                    // TODO: Remove and unwatch other directories contained within this directory.
                                    // getFileList() only returns files, and ignores directories.
                                }
                            }
                        }
                        
                        // Check for added directories and scan to add to index
                        // Re-scan this directory to add any new contents
                        len = contents ? contents.length : 0;
                        for (i = 0; i < len; i++) {
                            item = contents[i];
                            if (!oldContents || oldContents.indexOf(item) === -1) {
                                if (item.isDirectory()) {
                                    self._scanDirectory(item.fullPath);
                                }
                            }
                        }
                    });
            }
            
            // Trigger a change event
            $(this).trigger("change", entry);
        }
        // console.log("File/directory change: " + path + ", stat: " + stat);
    };
    
    /**
     * Set the root directory for the project. This clears any existing file cache
     * and starts indexing on a new worker.
     *
     * @param {string} rootPath The new project root.
     */
    FileSystem.prototype.setProjectRoot = function (rootPath) {
        // !!HACK FOR DEMO - if rootPath === "/Stuff", switch to the dropbox file system
        /*
        if (rootPath === "/Stuff") {
            setFileSystem("dropbox");
        } else {
            setFileSystem("appshell");
        }
        */
        
        // Remove trailing "/" from path
        if (rootPath && rootPath.length > 1) {
            if (rootPath[rootPath.length - 1] === "/") {
                rootPath = rootPath.substr(0, rootPath.length - 1);
            }
        }
        
        // Clear file index
        this._index.clear();
        
        // Initialize watchers
        this._impl.unwatchAll();
        this._impl.initWatchers(this._watcherCallback.bind(this));
        
        // Start indexing from the new root path
        this._scanDirectory(rootPath);
        
        // IAN-FS: should this wait for the directory scan to complete?
    };
    
    // Export the FileSystem class
    module.exports = FileSystem;
});
