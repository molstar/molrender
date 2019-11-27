/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Jesse Liang <jesse.liang@rcsb.org>
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import * as argparse from 'argparse'
import fs = require('fs')
import { ImageRenderer } from './render'
import { CifFrame } from 'molstar/lib/mol-io/reader/cif';
import { getModels, readCifFile } from './util';

const parser = new argparse.ArgumentParser({
    addHelp: true,
    description: 'Render images of a structure'
});
const subparsers = parser.addSubparsers({
    title: 'subcommands',
    dest: 'render'
});
subparsers
function addBasicArgs(currParser: argparse.ArgumentParser, isDir: boolean) {
    currParser.addArgument([ 'in' ], {
        action: 'store',
        help: 'path to mmCIF file'
    })
    currParser.addArgument([ 'out' ], {
        action: 'store',
        help: 'output directory for PNG images'
    });
    currParser.addArgument([ '--width' ], {
        action: 'store',
        help: 'image height',
        defaultValue: 2048
    });
    currParser.addArgument([ '--height' ], {
        action: 'store',
        help: 'image width',
        defaultValue: 1536
    });
}

const modParse = subparsers.addParser('model', {addHelp: true});
addBasicArgs(modParse, false)
modParse.addArgument([ 'modIndex' ], {
    action: 'store',
    help: 'model index'
});

const asmParse = subparsers.addParser('assembly', {addHelp: true})
addBasicArgs(asmParse, false)
asmParse.addArgument([ 'modIndex' ], {
    action: 'store',
    help: 'model index'
});
asmParse.addArgument([ 'asmIndex' ], {
    action: 'store',
    help: 'assembly index'
});

const chnParse = subparsers.addParser('chain', {addHelp: true})
addBasicArgs(chnParse, false)
chnParse.addArgument([ 'chainName' ], {
    action: 'store',
    help: 'chain name'
});

const combParse = subparsers.addParser('all', {addHelp: true})
addBasicArgs(combParse, false)

const args = parser.parseArgs();

if (!fs.existsSync(args.in)) {
    console.error(`Input path "${args.in}" does not exist`)
    process.exit(1)
}

if (!fs.existsSync(args.out)) {
    fs.mkdirSync(args.out, { recursive: true })
}

/**
 * Get file name without extension
 * @param inPath path of file
 */
export function getFileName(inPath: string) {
    const arr = inPath.split('/')
    return arr[arr.length - 1].split('.')[0]
}

async function main() {
    const renderer = new ImageRenderer(args.width, args.height)



    const fileName = getFileName(args.in)
    const cif = await readCifFile(args.in)
    const models = await getModels(cif as CifFrame)

    switch (args.render) {
        case 'all':
            await renderer.renderAll(models, args.out, fileName)
            break
        case 'chain':
            await renderer.renderChn(args.chainName, models[0], args.out, fileName)
            break
        case 'model':
            await renderer.renderMod(models[args.modIndex], args.out, fileName)
            break
        case 'assembly':
            await renderer.renderAsm(args.asmIndex, models[0], args.out, fileName)
            break
    }
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})