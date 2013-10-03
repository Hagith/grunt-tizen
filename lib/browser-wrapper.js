/**
 * Copyright 2013 Intel Corporate Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Wraps browser execution.
 */
var spawn = require('child_process').spawn;

module.exports = function (browserCmd, args, cb) {
  'use strict';

  var child = spawn(browserCmd, args, {detached: true});
  child.stdout.on('data', function (data) {
    cb(false, data, null);
  });
  child.stderr.on('data', function (data) {
    cb(true, null, data);
  });
  child.unref();
};
