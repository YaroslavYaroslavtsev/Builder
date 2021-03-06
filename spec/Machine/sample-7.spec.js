// Copyright (c) 2016-2019 Electric Imp
// This file is licensed under the MIT License
// http://opensource.org/licenses/MIT

'use strict';

require('jasmine-expect');

const fs = require('fs');
const path = require('path');
const eol = require('eol');

const FILE = __dirname + '/../fixtures/sample-7/input.nut';
const init = require('./init')(FILE);

describe('Machine', () => {
  let machine, src;

  beforeEach(() => {
    machine = init.createMachine();
    machine.file = path.basename(FILE);
    src = eol.lf(fs.readFileSync(FILE, 'utf-8'));
  });

  it('should run sample #7', () => {
    machine.generateLineControlStatements = false;
    const result = eol.lf(machine.execute(src));
    expect(result).toEqual(init.getResult());
  });

  it('should run sample #7 with line control', () => {
    machine.generateLineControlStatements = true;
    const result = eol.lf(machine.execute(src));
    expect(result).toEqual(init.getResultWithLineControl());
  });

});
