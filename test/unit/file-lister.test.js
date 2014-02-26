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
var chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));
require('mocha-as-promised')();
var expect = chai.expect;

var path = require('path');
var fs = require('fs');

var fileLister = require('../../lib/file-lister');

var dataDir = path.join(__dirname, 'data');
var oldestPath = path.join(dataDir, 'oldest.txt');
var olderPath = path.join(dataDir, 'older.txt');
var youngestPath = path.join(dataDir, 'youngest.txt');

// set the same mtimes on the files on every test run
var oldestTime = 1372702811185;
var olderTime = oldestTime + (60 * 1000);
var youngestTime = olderTime + (60 * 1000);

var touchFile = function (path, timestamp) {
  var time = new Date(timestamp);
  fs.utimesSync(path, time, time)
};

touchFile(oldestPath, oldestTime);
touchFile(olderPath, olderTime);
touchFile(youngestPath, youngestTime);

// glob() returns a path containing forward slashes, whether
// running on Windows or *nix; for the purposes of comparing
// paths in tests, we convert back slashes to forward slashes
var convertSlashes = function (str) {
  return str.replace(/\\/g, '/');
};

// main
describe('file lister', function () {
  it('should list files in time order', function () {
    var latest = fileLister.getLatest([
      oldestPath,
      olderPath,
      youngestPath
    ]);

    latest.should.equal(youngestPath);
  });

  it('should throw an error if localFiles is invalid', function () {
    return fileLister.list(null).should.be.rejectedWith(Error);
  });

  it('should return the original string in an array if localFiles is a single string', function () {
    return fileLister.list('foo.txt').should.be.eventually.eql(['foo.txt']);
  });

  it('should return an error if pattern is invalid', function () {
    return fileLister.list({pattern: null}).should.be.rejectedWith(Error);
  });

  it('should list files matching a glob', function () {
    var expected = [
      convertSlashes(olderPath),
      convertSlashes(oldestPath)
    ];

    var glob = path.join(dataDir, 'old*');
    return fileLister.list({pattern: glob}).should.be.eventually.eql(expected);
  });

  it('should return the most-recently-modified file matching a glob', function (done) {
    var expected = [ convertSlashes(olderPath) ];

    var glob = path.join(dataDir, 'old*');
    fileLister.list({pattern: glob, filter: 'latest'}).then(function(files) {
      files.should.be.eql(expected);

      // manual check that the returned file is correct
      var mtimeOlder = fs.statSync(olderPath).mtime.getTime()
      var mtimeOldest = fs.statSync(oldestPath).mtime.getTime()

      expect(mtimeOlder).to.be.greaterThan(mtimeOldest);

      done();
    });
  });

  it('should return the original array if a string array is passed in', function () {
    var expected = [ oldestPath, olderPath ];
    return fileLister.list([ oldestPath, olderPath ]).should.be.eventually.eql(expected);
  });
});
