/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {
    "use strict";

    var CommandManager = brackets.getModule('command/CommandManager'),
        Menus = brackets.getModule('command/Menus'),
        MainViewManager = brackets.getModule('view/MainViewManager'),
        EditorManager = brackets.getModule('editor/EditorManager'),
        DocumentManager = brackets.getModule('document/DocumentManager'),
        FileSystem = brackets.getModule('filesystem/FileSystem'),
        ProjectManager = brackets.getModule('project/ProjectManager'),
        Dialogs = brackets.getModule('widgets/Dialogs'),
        DefaultDialogs = brackets.getModule('widgets/DefaultDialogs'),
        ProjectModel = brackets.getModule('project/ProjectModel');

    var Helper = require('helper');

    var Recoder = function() {
        var self = this;

        this.currentDocument = null;
        this.recording = false;
        this.saveDir = null;
        this.startTime = null;
        this.lastTime = null;
        this.trackedFiles = [];
        this.trackedFileObjects = [];
        this.actions = [];

        this.onTextChangeProxy = Recoder.prototype.onTextChange.bind(this);
        this.onActiveEditorChangeProxy = Recoder.prototype.onActiveEditorChange.bind(this);
        this.onSelectionChangeProxy = Recoder.prototype.onSelectionChange.bind(this);
    };

    Recoder.prototype.addEvent = function(e) {
        var now = Date.now();
        var difference = now - this.lastTime;

        if (e.distance == null) {
            e.distance = difference;
            this.lastTime = now;
        }

        this.actions.push(e);
    };

    Recoder.prototype.onActiveEditorChange = function(e, editorGainingFocus, editorLosingFocus) {
        this.removeDocument();
        this.addDocument();
    };

    // This function *tries* to handle multiple selections
    // Proper tests need to be built to make sure that actually works
    Recoder.prototype.onTextChange = function(e, document, changelist) {
        var first = true;

        // Codemirror gives us the list of changes already sorted correctly
        // Just handle it as it comes
        changelist.forEach(function(change) {
            var event = {
              data: change.text,
              position: {
                  row: change.from.line,
                  col: change.from.ch
              },
              length: {
                  row: change.to.line - change.from.line,
                  col: change.to.ch  - change.from.ch
              },
              mode: 0
            };

            if (!first) {
                event.distance = 0;
            }

            this.addEvent(event);

            first = false;
        }.bind(this));
    };

    Recoder.prototype.onSelectionChange = function(e, editor) {
        var sel = this.currentEditor.getSelection ();

        if (sel != null) {
            var event = {
                mode: 1,
                position: {
                    row: sel.reversed ? sel.end.line : sel.start.line,
                    col: sel.reversed ? sel.end.ch : sel.start.ch
                },
                length: {
                    row: (sel.reversed ? -1 : 1) * (sel.end.line - sel.start.line),
                    col: (sel.reversed ? -1 : 1) * (sel.end.ch - sel.start.ch)
                }
            };

            this.addEvent(event);
        }
    }

    Recoder.prototype.addDocument = function() {
        this.currentEditor = EditorManager.getActiveEditor();

        if (this.currentEditor) {
            this.currentDocument = this.currentEditor.document;

            var displayPath = ProjectManager.makeProjectRelativeIfPossible(this.currentDocument.file.fullPath);
            var name = displayPath.replace(/\//g, '--');

            this.addEvent({
                data: name,
                mode: 2
            });

            if (this.trackedFiles.indexOf(this.currentDocument.file.fullPath) === -1) {
                this.trackedFileObjects.push({
                    path: name,
                    name: displayPath
                });
                this.trackedFiles.push(this.currentDocument.file.fullPath);
                var path = this.saveDir + name;
                var file = FileSystem.getFileForPath(path);
                file.write(this.currentDocument.getText(), function(error, stats) {
                    if (error) {
                        console.error("Error saving new Recode file: " + error);
                    }
                });
            }
            this.currentDocument.addRef();
            this.currentDocument.on('change', this.onTextChangeProxy);
            this.currentEditor.on('cursorActivity', this.onSelectionChangeProxy);
            this.onSelectionChange();
        }
    };

    Recoder.prototype.removeDocument = function() {
        if (this.currentEditor) {
            this.currentEditor.off('cursorActivity', this.onSelectionChangeProxy);
            this.currentDocument.off('change', this.onTextChangeProxy);
            this.currentDocument.releaseRef();
        }
        this.currentDocument = null;
        this.currentEditor = null;
    };

    Recoder.prototype.start = function(callback) {
        var self = this;
        var now = new Date();
        var formatDate = (now.getFullYear()) + '-'
            + (Helper.addTrailingZeros(now.getMonth() + 1, 2)) + '-'
            + (Helper.addTrailingZeros(now.getDate(), 2)) + '_'
            + (Helper.addTrailingZeros(now.getHours(), 2)) + '-'
            + (Helper.addTrailingZeros(now.getMinutes(), 2)) + '-'
            + (Helper.addTrailingZeros(now.getSeconds(), 2));
        var recodeFolder = ProjectManager.getProjectRoot().fullPath + 'recode-sessions/';

        var startRecode = function startRecode() {
            self.recording = true;

            self.startTime = self.lastTime = Date.now();

            EditorManager.on('activeEditorChange', self.onActiveEditorChangeProxy);
            self.addDocument();

            callback();
        };

        var makeDirectory = function makeDirectory() {
            self.startTime = now.getTime();
            self.saveDir = recodeFolder + formatDate + '/';

            ProjectManager
                .createNewItem(ProjectManager.getProjectRoot(), 'recode-sessions/' + formatDate + '/', true, true)
                .done(startRecode);
        };

        FileSystem.resolve(recodeFolder, function(error, file, stats) {
            if ((error) && (error !== 'NotFound')) {
                Dialogs.showModalDialog(DefaultDialogs.DIALOG_ID_ERROR, 'Error', 'Something went wrong when trying to find the recode-sessions folder: ' + error);
                return;
            }

            if ((!file) || (file.isDirectory)) {
                makeDirectory();
            } else {
                Dialogs.showModalDialog(DefaultDialogs.DIALOG_ID_ERROR, 'Save Error', 'The entry "recode-sessions" at project root must be a directory, currently it is not.');
            }
        });
    };

    Recoder.prototype.save = function() {
        var finaldata = { };
        var compressed = Helper.compress(this.actions);

        finaldata.files = this.trackedFileObjects;
        finaldata.recorded = compressed.compressed;
        finaldata.varMap = compressed.keys;

        var savepath = this.saveDir + 'recodedata.json';
        var file = FileSystem.getFileForPath(savepath);
        file.write(JSON.stringify(finaldata), function(error, stats) {
            if (error) {
                console.error("Error saving new Recode data: " + error);
            }
        });
    };

    Recoder.prototype.stop = function() {
        this.recording = false;

        this.save();

        // Unbind events
        EditorManager.off('activeEditorChange', this.onActiveEditorChangeProxy);
        this.trackedFiles = [];
        this.actions = [];
        this.removeDocument();
    };

    module.exports = exports = Recoder;
});
