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

const modelParser = subparsers.addParser('model', { addHelp: true });
addBasicArgs(modelParser, false)
modelParser.addArgument([ 'modIndex' ], {
    action: 'store',
    help: 'model index'
});

const assmblyParser = subparsers.addParser('assembly', { addHelp: true })
addBasicArgs(assmblyParser, false)
assmblyParser.addArgument([ 'asmIndex' ], {
    action: 'store',
    help: 'assembly index'
});

const chainParser = subparsers.addParser('chain', { addHelp: true })
addBasicArgs(chainParser, false)
chainParser.addArgument([ 'chainName' ], {
    action: 'store',
    help: 'chain name'
});

const modelsParser = subparsers.addParser('models', { addHelp: true })
addBasicArgs(modelsParser, false)

const allParser = subparsers.addParser('all', { addHelp: true })
addBasicArgs(allParser, false)

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
            await renderer.renderChain(args.chainName, models[0], args.out, fileName)
            break
        case 'model':
            await renderer.renderModel(models[args.modIndex], args.out, fileName)
            break
        case 'assembly':
            await renderer.renderAssembly(args.asmIndex, models[0], args.out, fileName)
            break
        case 'models':
            await renderer.renderModels(models, args.out, fileName)
            break
    }
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})