// Copyright (c) 2016-2020 Electric Imp
// This file is licensed under the MIT License
// http://opensource.org/licenses/MIT

'use strict';

const Builder = require('../../src');
const Log = require('log');
const path = require('path');

describe('Remote relative option is enabled', () => {

  let builder;
  const contextPath = path.resolve(__dirname + "/../fixtures/include/sample-2/").replace(/\\/g, '/');

  beforeEach(() => {
    builder = new Builder();
    builder.machine.remoteRelativeIncludes = true;
    builder.machine.path = contextPath;
    builder.machine.readers.github.username = process.env.SPEC_GITHUB_USERNAME;
    builder.machine.readers.github.token = process.env.SPEC_GITHUB_PASSWORD || process.env.SPEC_GITHUB_TOKEN;
    builder.machine.clearCache = true;
    builder.logger = new Log(process.env.SPEC_LOGLEVEL || 'error');
  });

  fdescribe('X path by https link', () => {

    const httpsPath = "https://raw.githubusercontent.com/YaroslavYaroslavtsev/Builder/feature/ADO-310-includes-enhancement/spec/fixtures/include/sample-2";

    it('should search Y file by web link', () => {
      let output = builder.machine.execute(`@include "` + httpsPath + `/LibA/dirX/x_case_y_https.nut"`);
      expect(output).toContain('// y.nut (case 1)\n');
    });

    it('should search Y file in remote repository', () => {
      let output = builder.machine.execute(`@include "` + httpsPath + `/LibA/dirX/x_case_y_github.nut"`);
      expect(output).toContain('// y.nut (case 1)\n');
    });

    it('should search Y file in remote repository', () => {
      let output = builder.machine.execute(`@include "` + httpsPath + `/LibA/dirX/x_case_y_rel_local.nut"`);
      expect(output).toContain('// y.nut (case 1)\n');
    });

    it('should search Y file by local abs path', () => {

      let output = builder.machine.execute(`@include "` + httpsPath + `/LibA/dirX/x_case_y_abs_local.nut"`);
      expect(output).toContain('// y.nut (case 1)\n');
    });
  });
});

describe('Remote relative option is not enabled', () => {

  let builder;
  const contextPath = path.resolve(__dirname + "/../fixtures/include/sample-2/").replace(/\\/g, '/');

  beforeEach(() => {
    builder = new Builder();
    builder.machine.remoteRelativeIncludes = false;
    builder.machine.path = contextPath;
    builder.machine.readers.github.username = process.env.SPEC_GITHUB_USERNAME;
    builder.machine.readers.github.token = process.env.SPEC_GITHUB_PASSWORD || process.env.SPEC_GITHUB_TOKEN;
    builder.machine.clearCache = true;
    builder.logger = new Log(process.env.SPEC_LOGLEVEL || 'error');
  });

  it('should search Y file in remote repository', () => {
    let output = builder.machine.execute(`@include "file_case1.nut"`);
    expect(output).toContain('// y.nut (case 1)\n');
  });

  it('should search Y file by web link', () => {
    let output = builder.machine.execute(`@include "file_case4.nut"`);
    expect(output).toContain('// y.nut (case 1)\n');
  });
});
