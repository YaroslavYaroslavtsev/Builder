// MIT License
//
// Copyright 2020 Electric Imp
//
// SPDX-License-Identifier: MIT
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
// EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
// OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
// ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

'use strict';

const request = require('request');
const path = require('path');
const upath = require('upath');
const childProcess = require('child_process');
const AbstractReader = require('./AbstractReader');

// Child process timeout
const TIMEOUT = 30000;
// Child process error return code
const STATUS_FETCH_FAILED = 2;
// Marker presence on the command line tells that we're in the worker thread
const WORKER_MARKER = '__azure_srv_reader_worker__';

class AzureReposReader extends AbstractReader {

  constructor() {
    super();
    this.timeout = TIMEOUT;
  }

  /**
   * Checks if the requested source can be read by this reader
   * @param {string} source
   * @return {boolean}
   */
  supports(source) {
    return AzureReposReader.parseUrl(source) !== false;
  }

  /**
   * Reads file from Azure Repos
   * @param {string} source - source URI
   * @param {object} options - options such as dependencies map
   * @return {string}
   */
  read(source, options) {
    this.logger.debug(`Reading Azure Repos source "${source}"...`);
    var commitID = null;
    var needCommitID = false;

    // Process dependencies
    if (options && options.dependencies) {
      if (options.dependencies.has(source)) {
        commitID = options.dependencies.get(source);
      } else {
        needCommitID = true;
      }
    }

    // spawn child process
    const child = childProcess.spawnSync(
      /* node */ process.argv[0],
      [/* self */ __filename,
        WORKER_MARKER,
        source,
        this.username,
        this.token,
        commitID,
        needCommitID
      ],
      { timeout: this.timeout }
    );

    if (child.status === STATUS_FETCH_FAILED) {
      // Predefined exit code errors
      throw new AbstractReader.Errors.SourceReadingError(child.stderr.toString());
    } else if (child.status) {
      // Misc exit code errors
      throw new AbstractReader.Errors.SourceReadingError(
        `Unknown error: ${child.stderr.toString()} (exit code ${child.status})`
      );
    } else {
      // Errors that do not set erroneous exit code
      if (child.error) {
        if (child.error.errno === 'ETIMEDOUT') {
          // Timeout
          throw new AbstractReader.Errors.SourceReadingError(
            `Failed to fetch url "${source}": timed out after ${this.timeout / 1000}s`
          );
        } else {
          // Others
          throw new AbstractReader.Errors.SourceReadingError(
            `Failed to fetch url "${source}": ${child.error.errno}`
          );
        }
      } else if (child.status === null) {
        // No status code is set, no error is set
        throw new AbstractReader.Errors.SourceReadingError(
          `Unknown error: "${source}"`
        );
      } else {
        // Success
        const ret = JSON.parse(child.output[1].toString());

        // Update dependencies map if needed
        if (needCommitID) {
          options.dependencies.set(source, ret.commitID);
        }

        return ret.data;
      }
    }
  }

  /**
   * Parse path
   * @param {string} source
   * @return {{__FILE__, __PATH__}}
   */
  parsePath(source) {
    const parsed = AzureReposReader.parseUrl(source);
    return {
      __FILE__: path.basename(parsed.path),
      __PATH__: `git-azure-repos:${parsed.org}/${parsed.project}/${parsed.repo}/${path.dirname(parsed.path)}`,
      __REPO_REF__: parsed.ref,
      __REPO_PREFIX__: `git-azure-repos:${parsed.org}/${parsed.project}/${parsed.repo}`
    };
  }

  /**
   * Fetches the source and outputs it to STDOUT
   * @param {string} source - source URI
   * @param {string} username - username (if required)
   * @param {string} password - password or token (if required)
   * @return {{data}}
   */
  static fetch(source, username, password, commitID, needCommitID) {
    var auth = null;

    if (username !== '' && password !== '') {
      auth = {
        "type": "basic",
        "username": username,
        "password": password
      };
    }

    const sourceParsed = this.parseUrl(source);
    var apiRequest = null;
    const promises = [AzureReposReader.downloadFile(auth, sourceParsed, commitID, needCommitID)];

    Promise.all(promises).then(function(results) {
      if (AzureReposReader.isJsonString(results[0])) {
        const data = JSON.parse(results[0]);
        if (data.commitId) {
          const ret = {
            data: data.content,
            commitID: data.commitId
          };
          process.stdout.write(JSON.stringify(ret));
        }
      } else {
        const ret = {
          data: results[0],
          commitID: null
        };
        process.stdout.write(JSON.stringify(ret));
      }
    });
  }

  /**
   * Makes an HTTP request to download the source file
   * @param {object} sourceParsed - parsed source URI
   * @return {Promise}
   */
  static downloadFile(auth, sourceParsed, commitID, needCommitID) {
    var url = null;
    var authHeaderValue = 'Basic ' + Buffer.from(auth.username + ":" + auth.password).toString('base64');

    var params = {
      url: url,
      headers: {
        'Authorization': authHeaderValue
      }
    };

    // Without save-dependencies/use-dependencies and without ref
    // commitID is always a string because it was passed as an arg of a process (childProcess.spawnSync)
    if (!sourceParsed.ref && needCommitID !== 'true' && commitID === 'null') {
      url = "https://dev.azure.com/" + sourceParsed.org + "/" + sourceParsed.project
          + "/_apis/git/repositories/" + sourceParsed.repo + "/items?path=" + sourceParsed.path + "&api-version=5.1";
      params.url = url;

      return new Promise(function(resolve, reject) {
        request.get(params, (error, resp, body) => {
          AzureReposReader.checkResponse(url, error, resp);
          resolve(body);
        });
      });

    // Without save-dependencies/use-dependencies and with ref
    // Trying ref as branch
    } else if (sourceParsed.ref && needCommitID !== 'true' && commitID === 'null') {
      url = "https://dev.azure.com/" + sourceParsed.org + "/" + sourceParsed.project
          + "/_apis/git/repositories/" + sourceParsed.repo + "/items?path=" + sourceParsed.path
          + "&api-version=5.1&versionDescriptor.version=" + sourceParsed.ref + "&versionDescriptor.versionType=branch";
      params.url = url;

      return new Promise(function(resolve, reject) {
        request.get(params, (error, resp, body) => {
          if (resp.statusCode == 404) {
            // If branch is not found, trying ref as tag
            url = "https://dev.azure.com/" + sourceParsed.org + "/" + sourceParsed.project
                + "/_apis/git/repositories/" + sourceParsed.repo + "/items?path=" + sourceParsed.path
                + "&api-version=5.1&versionDescriptor.version=" + sourceParsed.ref + "&versionDescriptor.versionType=tag";
            params.url = url;
            request.get(params, (error, resp, body) => {
              if (resp.statusCode == 404) {
                // If tag is not found, trying ref as commit
                url = "https://dev.azure.com/" + sourceParsed.org + "/" + sourceParsed.project
                    + "/_apis/git/repositories/" + sourceParsed.repo + "/items?path=" + sourceParsed.path + "&api-version=5.1"
                    + "&versionDescriptor.version=" + sourceParsed.ref + "&versionDescriptor.versionType=commit";
                params.url = url;
                request.get(params, (error, resp, body) => {
                  AzureReposReader.checkResponse(url, error, resp);
                  resolve(body);
                });
              } else {
                AzureReposReader.checkResponse(url, error, resp);
                resolve(body);
              }
            });
          } else {
            AzureReposReader.checkResponse(url, error, resp);
            resolve(body);
          }
        });
      });

    // With save-dependencies and without ref
    } else if (!sourceParsed.ref && needCommitID === 'true' && commitID === 'null') {
      url = "https://dev.azure.com/" + sourceParsed.org + "/" + sourceParsed.project
          + "/_apis/git/repositories/" + sourceParsed.repo + "/items?path=" + sourceParsed.path + "&api-version=5.1"
          + "&$format=json&includeContent=true";
      params.url = url;

      return new Promise(function(resolve, reject) {
        request.get(params, (error, resp, body) => {
          AzureReposReader.checkResponse(url, error, resp);
          resolve(body);
        });
      });
    // With save-dependencies and with ref
    // Trying ref as branch
    } else if (sourceParsed.ref && needCommitID === 'true' && commitID === 'null') {
      url = "https://dev.azure.com/" + sourceParsed.org + "/" + sourceParsed.project
          + "/_apis/git/repositories/" + sourceParsed.repo + "/items?path=" + sourceParsed.path
          + "&api-version=5.1&$format=json&includeContent=true&versionDescriptor.version=" + sourceParsed.ref + "&versionDescriptor.versionType=branch";
      params.url = url;

      return new Promise(function(resolve, reject) {
        request.get(params, (error, resp, body) => {
          if (resp.statusCode == 404) {
            // If branch is not found, trying ref as tag
            url = "https://dev.azure.com/" + sourceParsed.org + "/" + sourceParsed.project
                + "/_apis/git/repositories/" + sourceParsed.repo + "/items?path=" + sourceParsed.path
                + "&api-version=5.1&$format=json&includeContent=true&versionDescriptor.version=" + sourceParsed.ref + "&versionDescriptor.versionType=tag";
            params.url = url;
            request.get(params, (error, resp, body) => {
              if (resp.statusCode == 404) {
                // If tag is not found, trying ref as commit
                url = "https://dev.azure.com/" + sourceParsed.org + "/" + sourceParsed.project
                    + "/_apis/git/repositories/" + sourceParsed.repo + "/items?path=" + sourceParsed.path
                    + "&api-version=5.1&$format=json&includeContent=true&versionDescriptor.version=" + sourceParsed.ref + "&versionDescriptor.versionType=commit";
                params.url = url;
                request.get(params, (error, resp, body) => {
                  AzureReposReader.checkResponse(url, error, resp);
                  resolve(body);
                });
              } else {
                AzureReposReader.checkResponse(url, error, resp);
                resolve(body);
              }
            });
          } else {
            AzureReposReader.checkResponse(url, error, resp);
            resolve(body);
          }
        });
      });
    // With use-dependencies
    } else if (commitID !== 'null') {
      url = "https://dev.azure.com/" + sourceParsed.org + "/" + sourceParsed.project
          + "/_apis/git/repositories/" + sourceParsed.repo + "/items?path=" + sourceParsed.path + "&api-version=5.1"
          + "&versionDescriptor.version=" + commitID + "&versionDescriptor.versionType=commit";
      params.url = url;

      return new Promise(function(resolve, reject) {
        request.get(params, (error, resp, body) => {
          AzureReposReader.checkResponse(url, error, resp);
          resolve(body);
        });
      });
    }
  }

  /**
   * Checks the response of an HTTP request. Terminates the process in case of an error
   * @param {string} url - request URL
   * @param {string} error - error message
   * @param {string} resp - response of the request
   */
  static checkResponse(url, error, resp) {
    try {
      if (error) {
        process.stderr.write(`Failed to fetch url "${url}": ${error}\n`);
        process.exit(STATUS_FETCH_FAILED);
      } else if (resp.statusCode < 200 || resp.statusCode >= 300) {
        process.stderr.write(`Failed to fetch url "${url}": HTTP/${resp.statusCode}\n`);

        // In many cases Azure Repos includes error message(s)
        process.stderr.write(`Response from the server: ${JSON.stringify(resp.body)}\n`);

        process.exit(STATUS_FETCH_FAILED);
      }
    } catch (err) {
      process.stderr.write(`Failed to fetch url "${url}": ${err}\n`);
      process.exit(STATUS_FETCH_FAILED);
    }
  }

  /**
   * Parse Azure Repos reference into parts
   * @param source
   * @return {false|{org, project, repo, path, ref}}
   */
  static parseUrl(source) {
    const m = source.match(
      /^(git-azure-repos:)(~?[a-z0-9\-\._]+)\/(~?[a-z0-9\-\._]+)\/([a-z0-9\-\._]+)\/(.*?)(?:@([^@]*))?$/i
    );

    if (m) {
      const res = {
        'org': m[2],
        'project': m[3],
        'repo': m[4],
        'path': m[5],
      };

      if (undefined !== m[6]) {
        res.ref = m[6];
      }

      return res;
    }

    return false;
  }

  /**
   * Check, if string is JSON string
   * @param source string to check
   * @return {boolean} result
   */
  static isJsonString(source) {
    try {
      JSON.parse(source);
    } catch (e) {
      return false;
    }
    return true;
  }

}

if (process.argv.indexOf(WORKER_MARKER) !== -1) {
  // Launch worker
  AzureReposReader.fetch(process.argv[3], process.argv[4], process.argv[5], process.argv[6], process.argv[7]);
} else {
  module.exports = AzureReposReader;
}