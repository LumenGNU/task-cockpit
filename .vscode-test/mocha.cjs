// @ts-check
require('source-map-support').install();
const Mocha = require('mocha');
const fs = require('node:fs');
const path = require('node:path');

const MOCHA_TEST_FILES = process.env.MOCHA_TEST_FILES;

if (!MOCHA_TEST_FILES) {
    throw new Error('??????????????????');
}

const MOCHA_REPORTER = process.env.MOCHA_REPORTER ?? 'spec';
const MOCHA_SLOW = process.env.MOCHA_SLOW !== undefined
    ? Number(process.env.MOCHA_SLOW)
    : undefined;

const MOCHA_TIMEOUT = process.env.MOCHA_TIMEOUT !== undefined
    ? Number(process.env.MOCHA_TIMEOUT)
    : undefined;

const MOCHA_UI = /** @type { keyof Mocha.InterfaceContributions } */(process.env.MOCHA_UI ?? 'tdd');

const SUMMARY_FILE = process.env.SUMMARY_FILE;
if (!SUMMARY_FILE) {
    throw new Error('?????????????');
}


/**
 * @returns { Promise<void> }
 */
exports.run = async function run() {

    const mocha = new Mocha({
        ui: MOCHA_UI,
        color: true,
        timeout: MOCHA_TIMEOUT,
        reporter: MOCHA_REPORTER,
        diff: true,
        fullTrace: false,
        slow: MOCHA_SLOW
    });


    for (const testFile of MOCHA_TEST_FILES.split(path.delimiter).sort()) {
        mocha.addFile(testFile);
    }

    return new Promise((resolve, reject) => {
        try {
            const runner = mocha.run((_failures) => {

                fs.writeFileSync(SUMMARY_FILE, JSON.stringify(runner.stats));
                process.stderr.write('\n');
                resolve();
            });
        }
        catch (error) {
            reject(error);
        }
    });
};
