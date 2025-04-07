/**
 * Copyright (c) 2019-2025 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Jesse Liang <jesse.liang@rcsb.org>
 * @author Sebastian Bittrich <sebastian.bittrich@rcsb.org>
 */

import * as util from 'util';
import fs = require('fs');
import * as zlib from 'zlib';
import { CIF, CifFrame } from 'molstar/lib/mol-io/reader/cif';
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';

const readFileAsync = util.promisify(fs.readFile);
const gunzipAsync = util.promisify(zlib.gunzip);

/**
 * Helper method that reads file and returns the data
 * Supports .gz (gzip) and .bcif formats
 * @param path path to file
 */
async function readFile(path: string) {
    const isBinary = /\.bcif(\.gz)?$/.test(path);
    const isGzipped = /\.gz$/.test(path);
    const input = await readFileAsync(path);

    if (isGzipped) {
        const unzipped = await gunzipAsync(input);
        return isBinary ? new Uint8Array(unzipped) : unzipped.toString('utf8');
    } else {
        return isBinary ? new Uint8Array(input) : input.toString('utf8');
    }
}

/**
 * Helper method to get the trajectory from a cif data
 * @param frame CifFrame data from file
 */
export async function getTrajectory(frame: CifFrame) {
    return await trajectoryFromMmCIF(frame).run();
}

/**
 * Helper method to open cif file
 * @param path path to file
 */
export async function openCif(path: string) {
    const data = await readFile(path);
    return parseCif(data);
}

/**
 * Reads cif file and returns the parsed data
 * @param path path to file
 */
export async function readCifFile(path: string) {
    const parsed = await openCif(path);
    return parsed.blocks[0];
}

/**
 * Helper method to parse cif data
 * @param data string of cif data
 */
async function parseCif(data: string | Uint8Array) {
    const comp = CIF.parse(data);
    console.time('parseCif');
    const parsed = await comp.run();
    console.timeEnd('parseCif');
    if (parsed.isError) throw parsed;
    return parsed.result;
}