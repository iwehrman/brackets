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
/*global define, $, window, brackets */

define(function (require, exports, module) {
    "use strict";

    function TrieNode(char, value) {
        this.char = char;
        this.value = value;
        this.isWord = false;
        this.children = {};
    }
    
    TrieNode.prototype.addChild = function (node) {
        var char = node.char;
        if (this.children[char]) {
            return false;
        } else {
            this.children[char] = node;
            return true;
        }
    };
    
    TrieNode.prototype.longestCommonPrefix = function () {
        var children = this.children,
            keys = Object.keys(children);
        if (keys.length === 1) {
            if (this.isWord) {
                return this.value;
            } else {
                return children[keys[0]].longestCommonPrefix();
            }
        } else {
            return this.value;
        }
    };
    
    function Trie(words) {
        this.root = new TrieNode(null, "");
        
        var self = this;
        words.forEach(function (word) {
            self.addWord(word);
        });
    }

    Trie.prototype.addWord = function (word) {
        var currentNode = this.root;
        word.split("").forEach(function (char, index) {
            var nextNode = currentNode.children[char];
            if (!nextNode) {
                nextNode = new TrieNode(char, currentNode.value + char);
                currentNode.addChild(nextNode);
            }
            currentNode = nextNode;
        });
        currentNode.isWord = true;
    };
    
    Trie.prototype.longestCommonPrefix = function () {
        return this.root.longestCommonPrefix();
    };
            
    module.exports = Trie;
});