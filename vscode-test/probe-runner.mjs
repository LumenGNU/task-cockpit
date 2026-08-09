#!/usr/bin/env -S bash -c 'NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; exec node "$1" "${@:2}"' --

// @ts-check

import * as C from './color.mjs';

// Проверка версии Node.js
const REQUIRED_NODE_MAJOR = 22;
const currentMajor = parseInt(process.versions.node.split('.')[0], 10);
if (currentMajor < REQUIRED_NODE_MAJOR) {
    process.stderr.write(
        `${C.fail('🛇 ')} Node.js v${REQUIRED_NODE_MAJOR}+ is required (current: v${process.versions.node})\n`
    );
    process.exit(1);
}

import sm from 'source-map-support';
sm.install();



import { runTests } from '@vscode/test-electron';
import path from 'node:path';
import fs from 'node:fs';


const CWD = process.cwd();

const OUT_DIR = process.env.OUT_DIR ?? '';


if (!OUT_DIR) {
    throw new Error('OUT_DIR is not set');
}


if (!fs.existsSync(OUT_DIR)) {
    throw new Error(`Output directory not found: "${OUT_DIR}"`);
}


const SUT_PROBE = process.env.SUT_PROBE;


if (!SUT_PROBE || !fs.existsSync(SUT_PROBE)) {
    throw new Error(`Probe directory not found: "${SUT_PROBE}"`);
}


const VSC_VERSION = process.env.VSC_VERSION ?? '1.86.2';
const VSC_PROFILE = process.env.VSC_PROFILE ?? "ProbeProfile";
const VSC_PARAM_LOG = process.env.VSC_PARAM_LOG;

const VSC_OPEN = process.env.VSC_OPEN ? process.env.VSC_OPEN.split(path.delimiter) : [SUT_PROBE];

const extensionDevelopmentPath = (() => {

    const developmentPath = path.join(CWD, OUT_DIR, SUT_PROBE);

    const inPkgJson = path.join(CWD, SUT_PROBE, 'package.json');

    if (!fs.existsSync(inPkgJson)) {
        throw new Error(`package.json not found in probe suite: "${inPkgJson}"`);
    }

    // копирование package.json
    fs.copyFileSync(inPkgJson, path.join(developmentPath, 'package.json'));

    const extJs = path.join(CWD, OUT_DIR, SUT_PROBE, 'extension.js');
    if (!fs.existsSync(extJs)) {
        throw new Error(`extension.js not found in probe suite output: "${extJs}"`);
    }

    return developmentPath;
})();


const extensionTestsPath = (() => {
    const extensionTestsPath = path.resolve(CWD, path.join('.', '.vscode-test', 'probe.cjs'));
    if (!fs.existsSync(extensionTestsPath)) {
        throw new Error(`Extension probe runner not found: "${extensionTestsPath}"`);
    }
    return extensionTestsPath;
})();



async function main() {
    await runProbe();
}




/**
 * @returns { Promise<void> }
*/
async function runProbe() {

    let exitCode = -1;

    try {
        exitCode = await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            version: VSC_VERSION,
            launchArgs: [
                ...VSC_OPEN,
                '--disable-gpu',
                '--disable-telemetry',
                '--disable-crash-reporter',
                '--disable-extensions',
                '--locale', 'en-US',
                '--profile', VSC_PROFILE,
                ...(VSC_PARAM_LOG ? ['--log', VSC_PARAM_LOG] : [])
            ],
            extensionTestsEnv: {

            }
        });
    }
    catch (error) {
        // ожидаемо, не ошибка
    }

    process.stderr.write(`\nExtension host exited with code: ${exitCode}\n`);

}


await main();
process.exit(0);
