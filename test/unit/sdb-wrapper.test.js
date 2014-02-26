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
var chai = require('chai'),
    expect = chai.expect;
chai.should();
chai.use(require('chai-as-promised'));
require('mocha-as-promised')();

var SdbWrapper = require('../../lib/sdb-wrapper');

describe('SdbWrapper', function () {

  var wrapper;

  beforeEach(function () {
    wrapper = new SdbWrapper({
      sdbCmd: process.env.SDB || 'sdb'
    });
  });

  describe('contruct()', function () {
    it('should throw error when no cmd passed in config', function() {
      var testConstruct = function () {
        var wrapper = new SdbWrapper({});
      }

      expect(testConstruct).to.throw(Error);
    });
  });

  describe('execute()', function () {
    it('should fail for unknown command', function() {
      var promise = wrapper.execute('non-existent');
      return promise.should.be.rejectedWith(Error);
    });

    it('should return "sdb version" result', function() {
      var promise = wrapper.execute('version');
      return promise.should.eventually.match(/Smart Development Bridge/);
    });
  });

  describe('shell()', function () {
    it('should fail when call unsupported remote command', function() {
      var promise = wrapper.shell('non-existent');
      return promise.should.be.rejectedWith(Error);
    });

    it('should fail when no file/directory', function() {
      var promise = wrapper.shell('/home/developer/non-existent.sh');
      return promise.should.be.rejectedWith(Error);
    });

    it('should call remote command and return result', function() {
      var promise = wrapper.shell('whoami');
      return promise.should.eventually.match(/developer/);
    });
  });

  describe('push()', function () {
    it('should fail when local file not exist', function(done) {
      var promise = wrapper.push('./non-existent.txt', '/home/developer/');
      promise.should.be.rejectedWith(Error).notify(done);
    });

    it('should fail when can\'t save file on remote - no privileges', function() {
      // ensure root mode is off
      return wrapper.execute('root off').then(function() {
        var promise = wrapper.push('./test/unit/data/config.xml', '/etc/');
        return promise.should.be.rejectedWith(Error);
      });
    });

    it('should be fulfilled', function() {
      var promise = wrapper.push('./test/unit/data/config.xml', '/home/developer/');
      return promise.should.be.fulfilled;
    });
  });

  describe('forward()', function () {
    it('should be fulfilled', function() {
      var promise = wrapper.forward(2222, 22);
      return promise.should.be.fulfilled;
    });
  });

  describe('root()', function () {
    it('should be fulfilled', function(done) {
      var promise = wrapper.forward(2222, 22);
      return promise.should.be.fulfilled;
    });
  });

});
