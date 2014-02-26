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
 * Make a TizenConfig object which wraps the specified config.xml file.
 *
 * {Object} config Configuration object.
 * {String} [config.configFile='config.xml'] config.xml to wrap.
 */
module.exports = function (config) {
  'use strict';

  var tizenConfig = require('./tizen-config').create({
    // set at runtime from config; location of config.xml
    configFile: config.configFile || 'config.xml'
  });

  return tizenConfig;
};
