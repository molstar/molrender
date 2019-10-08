/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Jesse Liang <jesse.liang@rcsb.org>
 */

import * as argparse from 'argparse'
import fs = require('fs')
import { RenderAll, readCifFile, getModels, getID } from './render'
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

const modParse = subparsers.addParser('model', {addHelp: true});
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

const asmParse = subparsers.addParser('assembly', {addHelp: true})
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

const chnParse = subparsers.addParser('chain', {addHelp: true})
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

const combParse = subparsers.addParser('combined', {addHelp: true})
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

if (!fs.existsSync(args.in)) {
    console.log(`Input path "${args.in}" does not exist`)
    process.exit(1)
}

if (!fs.existsSync(args.out)) {
    console.log(`Output path "${args.out}" does not exist`)
    process.exit(1)
}

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
            try {
                await renderer.renderList(args.in, args.out, args.list)
                process.exit()
            } catch (e) {
                console.log(e)
                process.exit(1)
            }
        case 'combined':
            try {
                await renderer.renderComb(args.in, args.out)
                process.exit()
            } catch (e) {
                console.log(e)
                process.exit(1)
            }
        case 'chain':
            try {
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
            } catch (e) {
                console.log(e)
                process.exit(1)
            }
        case 'model':
            try {
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
            } catch (e) {
                console.log(e)
                process.exit(1)
            }
        case 'assembly':
            try {
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
            } catch (e) {
                console.log(e)
                process.exit(1)
            }
    }
}

main()