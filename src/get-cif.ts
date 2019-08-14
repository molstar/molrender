/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Jesse Liang <jesse.liang@rcsb.org>
 */

import * as argparse from 'argparse'
import fs = require('fs')
import { CIF, CifFrame } from 'molstar/lib/mol-io/reader/cif'
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { ajaxGet } from 'molstar/lib/mol-util/data-source';

async function parseCif(data: string|Uint8Array) {
    const comp = CIF.parse(data);
    const parsed = await comp.run();
    if (parsed.isError) throw parsed;
    return parsed.result;
}

async function downloadCif(id: string, isBinary: boolean) {
    const url = `https://files.rcsb.org/download/${id}.cif`
    const data = await ajaxGet({ url, type: isBinary ? 'binary' : 'string' }).run();
    return parseCif(data);
}

async function downloadFromPdb(pdb: string) {
    const parsed = await downloadCif(pdb, false);
    return parsed.blocks[0];
}

async function getModels(frame: CifFrame) {
    return await trajectoryFromMmCIF(frame).run();
}

async function runTests(id: string, index: number) {

    try {
        const cif = await downloadFromPdb(id);
        const models = await getModels(cif as CifFrame)
        console.log(models.length + ' ' + models[index].symmetry.assemblies.length)
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}

const parser = new argparse.ArgumentParser({
    addHelp: true,
    description: 'render image as PNG (work in progress)'
});

parser.addArgument([ 'id' ], {
    help: 'PDB id'
});
parser.addArgument([ 'index' ], {
    help: 'index'
});

interface Args {
    id: string
    index: number
}
const args: Args = parser.parseArgs();

runTests(args.id, args.index)