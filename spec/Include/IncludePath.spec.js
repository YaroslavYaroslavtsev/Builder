// Copyright (c) 2016-2020 Electric Imp
// This file is licensed under the MIT License
// http://opensource.org/licenses/MIT

'use strict';

const Builder = require('../../src');
const backslashToSlash = require('../backslashToSlash');
const Log = require('log');
const path = require('path');
const fs = require('fs');

fdescribe('Builder is called for file in included directory', () => {

  let builder;
  const contextPath = path.resolve(__dirname + "/../fixtures/include/sample-3/").replace(/\\/g, '/');

  beforeEach(() => {
    builder = new Builder();
    builder.machine.path = contextPath;
    builder.machine.readers.file.inputFileDir = contextPath;
    builder.logger = new Log(process.env.SPEC_LOGLEVEL || 'error');
  });

  fit('__PATH__ should be a local path', () => {
    const filePath = path.resolve(__dirname + "/../fixtures/include/sample-3/").replace(/\\/g, '/');
    let output = builder.machine.execute(`@include "file_case1.nut"`);
    expect(output).toContain(filePath);
  });

  fit('__PATH__ should be a remote repository path', () => {
    let output = builder.machine.execute(`@include "file_case2.nut"`);
    expect(output).toContain('// y.nut (case 1)\n');
  });

  fit('__PATH__ should be a web link', () => {
    let output = builder.machine.execute(`@include "file_case3.nut"`);
    expect(output).toContain('// y.nut (case 1)\n');
  });
});
