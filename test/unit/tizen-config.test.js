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
require('chai').should();
var sinon = require('sinon');

var path = require('path');
var dataDir = path.join(__dirname, 'data');

var mockConfigOkData = {
  'widget': {
    'tizen:application': [
      { '$': { 'id': 'id' } }
    ],
    '$': { 'id': 'uri' }
   }
};

var TizenConfig = require('../../lib/tizen-config');

describe('TizenConfig', function () {
  it('getMeta() should throw error if file doesn\'t exist', function (done) {
    try {
      var tc = TizenConfig.create({
        configFile: 'nonexistent/config.xml'
      });
      tc.getMeta();
    } catch (err) {
      err.should.be.instanceOf(Error);
    }
    done();
  });

  it('getMeta() should invoke callback with result object if config.xml parsed', function (done) {
    var expectedResult = {
      id: 'tetesttest',
      uri: 'https://github.com/01org/tetesttest',
      packageName: undefined,
      content: 'index.html'
    };
    var tc = TizenConfig.create({
      configFile: path.join(dataDir, 'config.xml')
    });
    tc.getMeta().should.to.eql(expectedResult);
    done();
  });

  it('getMeta() should throw error if config.xml parse fails', function (done) {
    try {
      var tc = TizenConfig.create({
        configFile: path.join(dataDir, 'config_bad.xml')
      });
      tc.getMeta();
    } catch (err) {
      err.should.be.instanceOf(Error);
    }
    done();
  });

  it('getMeta() should return cached config on second and subsequent calls', function (done) {
    var tc = TizenConfig.create({
      configFile: path.join(dataDir, 'config.xml')
    });

    var expectedResult = {
      id: 'tetesttest',
      uri: 'https://github.com/01org/tetesttest',
      packageName: undefined,
      content: 'index.html'
    };

    tc.getMeta().should.be.eql(expectedResult);

    // two calls to getMeta(); the second call should return the cached config

    // reset the configFile location; this ensures that if getMeta()
    // is called twice and caching doesn't happen, we get an error
    // (as getMeta() will try to load the non-existent file and parse it)
    tc.configFile = null;
    tc.getMeta().should.be.eql(expectedResult);

    done();
  });
});
