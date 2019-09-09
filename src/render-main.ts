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
chnParse.addArgument([ 'in' ], {
    action: 'store',
    help: 'input path of cif file'
});
chnParse.addArgument([ 'out' ], {
    action: 'store',
    help: 'output path of png files (not including file name)'
});
chnParse.addArgument([ 'index' ], {
    action: 'store',
    help: 'chain index'
});

const combParse = subparsers.addParser('all', {addHelp: true})
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


const args = parser.parseArgs();

let width = 2048
let height = 1536

async function main() {
    if (args.width != null) {
        width = args.width
    }
    if (args.height != null) {
        height = args.height
    }

    const id = getID(args.in)
    const folderName = `${id[1]}${id[2]}`

    let renderer = new RenderAll(width, height)
    let cif: CifBlock
    let models: readonly Model[]

    switch (args.render) {
        // case 'getlen':
        //     getArrLengths(args.modIndex, args.in)
        //     break;
        // case 'getNames':
        //     getChnNames(args.in)
        //     break;
        case 'all':
            renderer.renderComb(args.in, args.out)
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
            renderer.renderChn(args.index, models, args.out, id, null)
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
            renderer.renderMod(args.modIndex, models, args.out, id, null)
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
            renderer.renderAsm(args.modIndex, args.asmIndex, models, args.out, id, null)
            break;
    }
}

main()