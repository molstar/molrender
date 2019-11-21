/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Jesse Liang <jesse.liang@rcsb.org>
 */

import * as argparse from 'argparse'
import fs = require('fs')
import { ImageRenderer, readCifFile, getModels, getID } from './render'
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
subparsers
function addBasicArgs(currParser: argparse.ArgumentParser, isDir: boolean) {
    let inHelp = 'path of cif file'
    if (isDir) {
        inHelp = 'directory of all cif files'
    }
    currParser.addArgument([ 'in' ], {
        action: 'store',
        help: inHelp
    })
    currParser.addArgument([ 'out' ], {
        action: 'store',
        help: 'output path of png files (not including file name)'
    });
    currParser.addArgument([ '--width' ], {
        action: 'store',
        help: 'width of image'
    });
    currParser.addArgument([ '--height' ], {
        action: 'store',
        help: 'height of image'
    });
    currParser.addArgument([ '--threshold' ], {
        action: 'store',
        help: 'threshold for switching representations'
    });
    currParser.addArgument([ '--style' ], {
        action: 'store',
        choices: ['toon', 'matte', 'glossy', 'metallic'],
        help: 'style of render (toon, matte, glossy, or metallic)'
    })
    currParser.addArgument([ '--background' ], {
        action: 'store',
        choices: ['white', 'black', 'transparent'],
        help: 'background of render image (white, black, or transparent)'
    })
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
chnParse.addArgument([ 'name' ], {
    action: 'store',
    help: 'chain name'
});

const combParse = subparsers.addParser('combined', {addHelp: true})
addBasicArgs(combParse, false)

const allParse = subparsers.addParser('all', {addHelp: true})
addBasicArgs(allParse, true)
allParse.addArgument([ '--list' ], {
    action: 'store',
    help: 'path of file containing pdb IDs'
});

const args = parser.parseArgs();

let width = 2048
let height = 1536
let threshold = 5
let style = 0
let background = 0

if (!fs.existsSync(args.in)) {
    console.error(`Input path "${args.in}" does not exist`)
    process.exit(1)
}

if (!fs.existsSync(args.out)) {
    console.error(`Output path "${args.out}" does not exist`)
    process.exit(1)
}

async function main() {
    if (args.width !== null) {
        width = args.width
    }
    if (args.height !== null) {
        height = args.height
    }
    if (args.threshold !== null) {
        threshold = args.threshold
    }
    if (args.style !== null) {
        switch (args.style) {
            case 'toon':
                style = 0;
                break;
            case 'matte':
                style = 1;
                break;
            case 'glossy':
                style = 2;
                break;
            case 'metallic':
                style = 3;
                break;
            default:
                console.error(`Error: "${args.style}" is not a valid style`);
                process.exit(1);
        }
    }
    if (args.background !== null) {
        switch (args.background) {
            case 'white':
                background = 0;
                break;
            case 'black':
                background = 1;
                break;
            case 'transparent':
                background = 2;
                break;
            default:
                console.error(`Error: "${args.background}" is not a valid background`);
                process.exit(1);
        }
    }

    const id = getID(args.in)
    const folderName = `${id[1]}${id[2]}`;


    (async () => {
        let renderer = new ImageRenderer(width, height, threshold, style, background)
        let cif: CifBlock
        let models: readonly Model[]

        switch (args.render) {
            case 'all':
                await renderer.renderList(args.in, args.out, args.list).catch(() => {process.exit(1)})
                process.exit()
            case 'combined':
                await renderer.renderCombined(args.in, args.out).catch(() => {process.exit(1)})
                process.exit()
            case 'chain':
                if (!fs.existsSync(args.out + '/' + folderName)) {
                    fs.mkdirSync(args.out + '/' + folderName)
                }

                if (!fs.existsSync(`${args.out}/${folderName}/${id}`)) {
                    fs.mkdirSync(`${args.out}/${folderName}/${id}`)
                }

                args.out += `/${folderName}/${id}/`

                cif = await readCifFile(args.in)
                models = await getModels(cif as CifFrame)
                await renderer.renderChn(args.name, models, args.out, id).catch(() => {process.exit(1)})
                process.exit()
            case 'model':
                if (!fs.existsSync(args.out + '/' + folderName)) {
                    fs.mkdirSync(args.out + '/' + folderName)
                }

                if (!fs.existsSync(`${args.out}/${folderName}/${id}`)) {
                    fs.mkdirSync(`${args.out}/${folderName}/${id}`)
                }

                args.out += `/${folderName}/${id}/`

                cif = await readCifFile(args.in)
                models = await getModels(cif as CifFrame)
                await renderer.renderMod(args.modIndex, models, args.out, id).catch(() => {process.exit(1)})
                process.exit()
            case 'assembly':
                if (!fs.existsSync(args.out + '/' + folderName)) {
                    fs.mkdirSync(args.out + '/' + folderName)
                }

                if (!fs.existsSync(`${args.out}/${folderName}/${id}`)) {
                    fs.mkdirSync(`${args.out}/${folderName}/${id}`)
                }

                args.out += `/${folderName}/${id}/`

                cif = await readCifFile(args.in)
                models = await getModels(cif as CifFrame)
                await renderer.renderAsm(args.modIndex, args.asmIndex, models, args.out, id).catch(() => {process.exit(1)})
                process.exit()

        }
    })().catch((error) => {
        console.error(error)
        process.exit(1)
    })

}

main()