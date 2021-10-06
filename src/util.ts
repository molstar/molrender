/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Jesse Liang <jesse.liang@rcsb.org>
 */

import * as util from 'util';
import fs = require('fs');
import { CIF, CifFrame } from 'molstar/lib/mol-io/reader/cif';
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';

const readFileAsync = util.promisify(fs.readFile);

/**
 * Helper method that reads file and returns the data
 * @param path path to file
 */
async function readFile(path: string) {
    if (path.match(/\.bcif$/)) {
        const input = await readFileAsync(path);
        return new Uint8Array(input);
    } else {
        return readFileAsync(path, 'utf8');
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