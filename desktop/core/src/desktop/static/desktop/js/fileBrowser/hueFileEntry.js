// Licensed to Cloudera, Inc. under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  Cloudera, Inc. licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function (root, factory) {
  if(typeof define === "function" && define.amd) {
    define([
      'knockout'
    ], factory);
  } else {
    root.HueFileEntry = factory(ko);
  }
}(this, function (ko) {

  /**
   *
   * @param {Object} options
   * @param {AssistHelper} options.assistHelper
   * @param {Object} options.definition
   * @param {Function} options.currentDirectory - The observable keeping track of the current open directory
   * @param {HueFolder} options.parent
   * @param {string} options.app - Currently only 'documents' is supported
   *
   * @constructor
   */
  function HueFileEntry (options) {
    var self = this;
    self.currentDirectory = options.currentDirectory;
    self.parent = options.parent;
    self.definition = options.definition;
    self.assistHelper = options.assistHelper;
    self.name = self.definition.name.substring(self.definition.name.lastIndexOf('/') + 1);
    self.isRoot = self.name === '';
    self.isDirectory = self.definition.type === 'directory';
    self.path = self.definition.name;
    self.app = options.app;

    self.selected = ko.observable(false);

    self.loaded = ko.observable(false);
    self.loading = ko.observable(false);
    self.hasErrors = ko.observable(false);

    self.uploading = ko.observable(false);
    self.uploadComplete = ko.observable(false);
    self.uploadFailed = ko.observable(false);

    self.entries = ko.observableArray([]);

    self.selectedEntryIds = ko.pureComputed(function () {
      var ids = [];
      $.each(self.entries(), function (idx, entry) {
        if (entry.selected()) {
          ids.push(entry.definition.id);
        }
      });
      return ids;
    });

    self.breadcrumbs = [];
    var lastParent = self.parent;
    while (lastParent) {
      self.breadcrumbs.unshift(lastParent);
      lastParent = lastParent.parent;
    }
  }

  HueFileEntry.prototype.toggleSelected = function () {
    var self = this;
    self.selected(! self.selected());
  };

  HueFileEntry.prototype.open = function () {
    var self = this;
    if (self.definition.type === 'directory') {
      self.currentDirectory(self);
    } else {
      window.location.href = self.definition.absoluteUrl;
    }
  };

  HueFileEntry.prototype.load = function () {
    var self = this;
    if (self.loading()) {
      return;
    }
    self.loading(true);

    if (self.app === 'documents') {
      self.assistHelper.fetchDocuments({
        path: self.path,
        successCallback: function(data) {
          self.definition = data.file;
          self.hasErrors(false);
          var cleanEntries = $.grep(data.documents, function (definition) {
            return definition.name !== '/';
          });
          self.entries($.map(cleanEntries, function (definition) {
            return new HueFileEntry({
              currentDirectory: self.currentDirectory,
              assistHelper: self.assistHelper,
              definition: definition,
              app: self.app,
              parent: self
            })
          }));
          self.loading(false);
          self.loaded(true);
        },
        errorCallback: function () {
          self.hasErrors(true);
          self.loading(false);
          self.loaded(true);
        }
      });
    }
  };

  HueFileEntry.prototype.delete = function () {
    var self = this;
    if (self.app === 'documents') {
      self.assistHelper.deleteDocument({
        successCallback: self.parent.load.bind(self.parent),
        id: self.definition.id
      });
    }
  };

  HueFileEntry.prototype.closeUploadModal = function () {
    var self = this;
    if (self.app === 'documents') {
      $('#importDocumentsModal').modal('hide');
      $('#importDocumentInput').val('');
    }
    // Allow the modal to hide
    window.setTimeout(function () {
      self.uploading(false);
      self.uploadComplete(false);
      self.uploadFailed(false);
    }, 400);
  };

  HueFileEntry.prototype.upload = function () {
    var self = this;
    if (self.app === 'documents') {
      self.uploading(true);
      self.uploadComplete(false);
      self.uploadFailed(false);
      self.assistHelper.uploadDocument({
        formData: new FormData($('#importDocumentsForm')[0]),
        successCallback: function () {
          self.uploading(false);
          self.uploadComplete(true);
          self.load();
        },
        progressHandler: function (event) {
          $("#importDocumentsProgress").val(Math.round((event.loaded / event.total) * 100));
        },
        errorCallback: function () {
          self.uploading(false);
          self.uploadComplete(true);
          self.uploadFailed(true);
        }
      });
    }
  };

  HueFileEntry.prototype.showUploadModal = function () {
    if (self.app = 'documents') {
      $('#importDocumentsModal').modal('show');
    }
  };

  HueFileEntry.prototype.download = function () {
    var self = this;
    if (self.app = 'documents') {
      console.log(self.selectedEntryIds());
      if (self.selectedEntryIds().length > 0) {
        console.log('here');
        window.location.href = '/desktop/api2/doc/export?documents=' + ko.mapping.toJSON(self.selectedEntryIds());
      } else {
        window.location.href = '/desktop/api2/doc/export?documents=' + ko.mapping.toJSON([ self.definition.id ]);
      }
    };
  };

  HueFileEntry.prototype.createDirectory = function (name) {
    var self = this;
    if (self.app === 'documents') {
      self.assistHelper.createDocumentsFolder({
        successCallback: self.load.bind(self),
        path: self.path,
        name: name
      });
    }
  };

  return HueFileEntry;
}));
