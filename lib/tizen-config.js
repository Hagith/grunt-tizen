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
 * Parses config.xml file and makes its properties readily available;
 * NB even if you modify the configFile property directly, the cached
 * copy of the config XML will continue to be returned: there is no
 * way to reload the config.xml on the fly, as that's not necessary in
 * the context where we have a single config.xml file which can be loaded
 * once per grunt run.
 */
var fs = require('fs'),
    xml2json = require('xml2json');

/**
 * Create a Tizen config.xml file wrapper object.
 *
 * {String} config.configFile Path to the config.xml file to wrap
 */
var TizenConfig = function (config) {
  'use strict';

  this.configFile = config.configFile || 'config.xml';

  // cached copy of the configuration
  this.configParsed = null;
};

/**
 * Get metadata about the Tizen app from a config.xml file.
 * The values of the properties are derived from the config.xml file,
 * from the paths shown below.
 *
 * @returns {Object} config The configuration object has the format:
 * @returns {String} config.id : <widget> id attribute
 * @returns {String} config.uri : <widget> > <tizen:application> id attribute
 * @returns {String} config.packageName : <widget> > <tizen:application> package attribute
 * @returns {String} config.content : <widget> > <content> src attribute
 */
TizenConfig.prototype.getMeta = function () {
  'use strict';

  if (this.configParsed !== null) {
    return this.configParsed;
  }

  var content = fs.readFileSync(this.configFile, 'utf8');
  var data = JSON.parse(xml2json.toJson(content)).widget;
  this.configParsed = {
    id: data['tizen:application'].id,
    uri: data.id,
    packageName: data['tizen:application'].package,
    content: data.content.src
  };

  return this.configParsed;
};

module.exports = {
  create: function (config) {
    'use strict';
    return new TizenConfig(config);
  }
};
