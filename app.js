angular.module('wysiwyg', [
    'ui.ace',
    'hc.marked',
    'ngSanitize'
])
.config([ 'markedProvider', function (markedProvider) {
        markedProvider.setOptions({
            gfm: true,
            breaks: true,
            highlight: function (code) {
                return hljs.highlightAuto(code).value; // jshint undef:false
            }
        });
    }
])
.controller('editorCtrl', function ($scope, marked, Ace, MenuItems) {
    $scope.menuItems = MenuItems;
    $scope.preview = '';
    $scope.isEditing = true;
    $scope.configureAce = function (editor) {
        Ace.configure({
            editorInstance: editor,
            scope: $scope,
            scopeVariable: 'aceEditor'
        });

        // Workaround for ng-model sync issue
        /*
        $scope.aceEditor.on('change', function (event) {
            if (event.data.action !== 'insertText') {
                return;
            }

            $scope.textContent.$setViewValue($scope.aceEditor.getValue());
        });
        */
    };

    // Private Functions
    var _generatePreview = function (raw) {
        if (!raw) {
            return;
        }

        if (raw.toString().trim() !== '') {
            $scope.preview = marked(raw);
        } else {
            $scope.preview = '<small><em>nothing to preview</em></small>';
        }
    };//_generatePreview

    // Scope Functions
    $scope.togglePreview = function () {
        $scope.isEditing = !$scope.isEditing;
    };

    // Subscriptions
    $scope.$watch('isEditing', function (newVal) {
        if (newVal === true) {
            $scope.preview = '';
            $scope.aceEditor.focus();
        } else {
            _generatePreview($scope.textContent);
        }
    });
})
.value('MenuItems', [
    { icon: 'undo', cmd: 'undo' },
    { icon: 'repeat', cmd: 'redo' },
    { icon: 'bold', cmd: 'bold' },
    { icon: 'italic', cmd: 'italic' },
    { icon: 'strikethrough', cmd: 'strikethrough' },
    { icon: 'list-ol', cmd: 'orderedList' },
    { icon: 'list-ul', cmd: 'unorderedList' },
    { icon: 'ellipsis-h', cmd: null },
    { icon: 'link', cmd: 'hyperlink' }
])
.factory('Ace', function () {
    return {
        configure: function (options) {
            var _scope,
                _scopeVar,
                _editor,
                _session,
                _renderer,
                _undoManager;
            options = options || {};

            _scope = options.scope;
            _scopeVar = options.scopeVariable;
            _editor = options.editorInstance;
            _session = _editor.getSession();
            _renderer = _editor.renderer;

            // throw if no varName
            _scope[_scopeVar] = _editor;
            _editor.$blockScrolling = Infinity;

            // Configure undo manager
            _undoManager = new ace.UndoManager();
            _session.setUndoManager(_undoManager);

            // EditSession Options
            // bottom of https://github.com/ajaxorg/ace/blob/master/lib/ace/edit_session.js
            _session.setOptions({
                tabSize: 2,
                wrap: 100,
                useSoftTabs: true
            });

            // Editor Options
            // bottom of https://github.com/ajaxorg/ace/blob/master/lib/ace/editor.js
            _editor.setOptions({
                printMarginColumn: 100
            });

            // Renderer Options
            // bottom of https://github.com/ajaxorg/ace/blob/master/lib/ace/virtual_renderer.js
            _renderer.setOptions({
                displayIndentGuides: true,
                vScrollBarAlwaysVisible: true
            });


            // PRIVATE FUNCTIONS
            function _getSelectionRange () {
                return _editor.selection.getRange();
            }

            function _getSelection () {
                return _session.doc.getTextRange(_getSelectionRange());
            }

            function _replaceSelection () {
                _session.replace(_getSelectionRange(), replacement);
            }

            function _wrapSelection () {
                var _begin = wrapStart || '';
                var _end = wrapEnd || _begin;
                return _begin + _getSelection() + _end;
            }

            function _beginList () {
                var cursorStart = _editor.getCursorPosition();
                _editor.navigateLineStart();
                _editor.insert(listPrefix);

                // needed or navigation will ignore trailing space for empty list item
                if (cursorStart.column !== 0) {
                    _editor.navigateLineEnd();
                }
            }

            function _hasSelection () {
                return _getSelection() !== '';
            }

            var _commands = {
                'undo': function () {
                    _undoManager.undo();
                    _editor.focus();
                },

                'redo': function () {
                    _undoManager.redo();
                    _editor.focus();
                },

                /*
                 * The following work, but they are not updating the model.
                 * Preview doesn't update appropriately, afterward.
                 *
                 * Issue is with angular-ui-ace
                 * See https://github.com/angular-ui/ui-ace/pull/124
                 */
                'bold': function () {
                    if (_hasSelection()) { // wrap
                        _replaceSelection(_wrapSelection('**'));
                    } else { // insert
                        _editor.insert('****');
                        _editor.navigateLeft(2);
                    }
                    _editor.focus();
                },

                'italic': function () {
                    if (_hasSelection()) { // wrap
                        _replaceSelection(_wrapSelection('_'));
                    } else { // insert
                        _editor.insert('__');
                        _editor.navigateLeft(1);
                    }
                    _editor.focus();
                },

                'strikethrough': function () {
                    if (_hasSelection()) { // wrap
                        _replaceSelection(_wrapSelection('~~'));
                    } else { // insert
                        _editor.insert('~~~~');
                        _editor.navigateLeft(2);
                    }
                },

                'hyperlink': function () {
                    if (_hasSelection()) { // wrap
                        _replaceSelection(_wrapSelection('[', ']()'));
                        _editor.navigateLeft(1);
                    } else { // insert
                        _editor.insert('[](URL)');
                        _editor.navigateLeft(6);
                    }
                    _editor.focus();
                },

                'orderedList': function () {
                    _beginList('1. ');
                    _editor.focus();
                },

                'unorderedList': function () {
                    _beginList('* ');
                    _editor.focus();
                }
            };

            _scope.cmd = function (fnName) {
                if (_commands[fnName]) {
                    _commands[fnName]();
                    _editor.focus();
                }
            };

            _editor.commands.bindKeys({
                "cmd-l": null
            });

            return _editor;
        }
    };
});
