/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Jesse Liang <jesse.liang@rcsb.org>
 */

import * as argparse from 'argparse'
import fs = require('fs')
import { RenderAll, readCifFile, getModels, getID } from './render-all'
import { CifFrame, CifBlock } from 'molstar/lib/mol-io/reader/cif';
import { Model } from 'molstar/lib/mol-model/structure';

const parser = new argparse.ArgumentParser({
    addHelp: true,
    description: 'Render all models and assemblies of a PDB ID'
});
const subparsers = parser.addSubparsers({
    title: 'subcommands',
    dest: 'render'
});

const modParse = subparsers.addParser('mod', {addHelp: true});
modParse.addArgument([ '--width' ], {
    action: 'store',
    help: 'width of image'
});
modParse.addArgument([ '--height' ], {
    action: 'store',
    help: 'height of image'
});
modParse.addArgument([ '--threshold' ], {
    action: 'store',
    help: 'threshold for switching representations'
});
modParse.addArgument([ 'in' ], {
    action: 'store',
    help: 'input path of cif file'
});
modParse.addArgument([ 'out' ], {
    action: 'store',
    help: 'output path of png files (not including file name)'
});
modParse.addArgument([ 'modIndex' ], {
    action: 'store',
    help: 'model index'
});

const asmParse = subparsers.addParser('asm', {addHelp: true})
asmParse.addArgument([ '--width' ], {
    action: 'store',
    help: 'width of image'
});
asmParse.addArgument([ '--height' ], {
    action: 'store',
    help: 'height of image'
});
asmParse.addArgument([ '--threshold' ], {
    action: 'store',
    help: 'threshold for switching representations'
});
asmParse.addArgument([ 'in' ], {
    action: 'store',
    help: 'input path of cif file'
});
asmParse.addArgument([ 'out' ], {
    action: 'store',
    help: 'output path of png files (not including file name)'
});
asmParse.addArgument([ 'modIndex' ], {
    action: 'store',
    help: 'model index'
});
asmParse.addArgument([ 'asmIndex' ], {
    action: 'store',
    help: 'assembly index'
});

const chnParse = subparsers.addParser('chn', {addHelp: true})
chnParse.addArgument([ '--width' ], {
    action: 'store',
    help: 'width of image'
});
chnParse.addArgument([ '--height' ], {
    action: 'store',
    help: 'height of image'
});
chnParse.addArgument([ '--max' ], {
    action: 'store',
    help: 'max size of chain'
});
chnParse.addArgument([ 'in' ], {
    action: 'store',
    help: 'input path of cif file'
});
chnParse.addArgument([ 'out' ], {
    action: 'store',
    help: 'output path of png files (not including file name)'
});
chnParse.addArgument([ 'name' ], {
    action: 'store',
    help: 'chain name'
});

const combParse = subparsers.addParser('comb', {addHelp: true})
combParse.addArgument([ 'in' ], {
    action: 'store',
    help: 'input path of cif file'
})
combParse.addArgument([ 'out' ], {
    action: 'store',
    help: 'output path of png files (not including file name)'
});
combParse.addArgument([ '--width' ], {
    action: 'store',
    help: 'width of image'
});
combParse.addArgument([ '--height' ], {
    action: 'store',
    help: 'height of image'
});
combParse.addArgument([ '--threshold' ], {
    action: 'store',
    help: 'threshold for switching representations'
});

const allParse = subparsers.addParser('all', {addHelp: true})
allParse.addArgument([ 'in' ], {
    action: 'store',
    help: 'directory containing cifs to be rendered'
});
allParse.addArgument([ 'out' ], {
    action: 'store',
    help: 'output path of png files (not including file name)'
});
allParse.addArgument([ '--list' ], {
    action: 'store',
    help: 'path of file containing pdb IDs'
});
allParse.addArgument([ '--width' ], {
    action: 'store',
    help: 'width of image'
});
allParse.addArgument([ '--height' ], {
    action: 'store',
    help: 'height of image'
});
allParse.addArgument([ '--threshold' ], {
    action: 'store',
    help: 'threshold for switching representations'
});

const args = parser.parseArgs();

let width = 2048
let height = 1536
let max = 250
let threshold = 5

async function main() {
    if (args.width !== null) {
        width = args.width
    }
    if (args.height !== null) {
        height = args.height
    }
    if (args.max !== null) {
        max = args.max
    }
    if (args.threshold !== null) {
        threshold = args.threshold
    }

    const id = getID(args.in)
    const folderName = `${id[1]}${id[2]}`

    let renderer = new RenderAll(width, height, threshold)
    let cif: CifBlock
    let models: readonly Model[]

    switch (args.render) {
        case 'all':
            await renderer.renderList(args.in, args.out, args.list)
            process.exit()
            break
        case 'comb':
            await renderer.renderComb(args.in, args.out)
            process.exit()
            break
        case 'chn':
            if (!fs.existsSync(args.out + '/' + folderName)) {
                fs.mkdirSync(args.out + '/' + folderName)
            }

            if (!fs.existsSync(`${args.out}/${folderName}/${id}`)) {
                fs.mkdirSync(`${args.out}/${folderName}/${id}`)
            }

            args.out += `/${folderName}/${id}/`

            cif = await readCifFile(args.in)
            models = await getModels(cif as CifFrame)
            await renderer.renderChn(args.name, max, models, args.out, id)
            process.exit()
            break;
        case 'mod':
            if (!fs.existsSync(args.out + '/' + folderName)) {
                fs.mkdirSync(args.out + '/' + folderName)
            }

            if (!fs.existsSync(`${args.out}/${folderName}/${id}`)) {
                fs.mkdirSync(`${args.out}/${folderName}/${id}`)
            }

            args.out += `/${folderName}/${id}/`

            cif = await readCifFile(args.in)
            models = await getModels(cif as CifFrame)
            await renderer.renderMod(args.modIndex, models, args.out, id)
            process.exit()
            break;
        case 'asm':
            if (!fs.existsSync(args.out + '/' + folderName)) {
                fs.mkdirSync(args.out + '/' + folderName)
            }

            if (!fs.existsSync(`${args.out}/${folderName}/${id}`)) {
                fs.mkdirSync(`${args.out}/${folderName}/${id}`)
            }

            args.out += `/${folderName}/${id}/`

            cif = await readCifFile(args.in)
            models = await getModels(cif as CifFrame)
            await renderer.renderAsm(args.modIndex, args.asmIndex, models, args.out, id)
            process.exit()
            break;
    }
}

main()