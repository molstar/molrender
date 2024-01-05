/**
 * Copyright (c) 2019-2024 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Jesse Liang <jesse.liang@rcsb.org>
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Sebastian Bittrich <sebastian.bittrich@rcsb.org>
 * @author Ke Ma <mark.ma@rcsb.org>
 */

import * as argparse from 'argparse';
import fs = require('fs');
import { ImageRenderer } from './render';
import { CifFrame } from 'molstar/lib/mol-io/reader/cif';
import { getTrajectory, readCifFile } from './util';
import { Task } from 'molstar/lib/mol-task';
import { FocusFirstResidue } from './focus-camera/focus-first-residue';

const parser = new argparse.ArgumentParser({
    add_help: true,
    description: 'Render images of a structure'
});
const subparsers = parser.add_subparsers({
    title: 'subcommands',
    dest: 'render'
});

function addBasicArgs(currParser: argparse.ArgumentParser) {
    currParser.add_argument('in', {
        action: 'store',
        help: 'path to mmCIF file'
    });
    currParser.add_argument('out', {
        action: 'store',
        help: 'output directory for images'
    });
    currParser.add_argument('--width', {
        action: 'store',
        help: 'image width',
        default: 2048
    });
    currParser.add_argument('--height', {
        action: 'store',
        help: 'image height',
        default: 1536
    });
    currParser.add_argument('--format', {
        action: 'store',
        help: 'image format (png or jpeg)',
        default: 'png'
    });
    currParser.add_argument('--plddt', {
        action: 'store',
        help: 'color predicted structures by pLDDT (on, single-chain, or off)',
        default: 'single-chain'
    });
    currParser.add_argument('--save-state', {
        action: 'store', 
        help: 'save the molrender state to regenerate protein view in molstar',
        default: false 
    });
}

const modelParser = subparsers.add_parser('model', { add_help: true });
addBasicArgs(modelParser);
modelParser.add_argument('modIndex', {
    action: 'store',
    help: 'model index'
});

const assmblyParser = subparsers.add_parser('assembly', { add_help: true });
addBasicArgs(assmblyParser);
assmblyParser.add_argument('asmIndex', {
    action: 'store',
    help: 'assembly index'
});

const chainParser = subparsers.add_parser('chain', { add_help: true });
addBasicArgs(chainParser);
chainParser.add_argument('chainName', {
    action: 'store',
    help: 'chain name'
});

const modelsParser = subparsers.add_parser('models', { add_help: true });
addBasicArgs(modelsParser);

const allParser = subparsers.add_parser('all', { add_help: true });
addBasicArgs(allParser);


const chainListParser = subparsers.add_parser('chain-list', { add_help: true });
addBasicArgs(chainListParser);
chainListParser.add_argument('asmIndex', {
    action: 'store',
    help: 'assembly index',
});
chainListParser.add_argument('chainList', {
    action: 'store',
    nargs: '*',
    help: 'chain chainName1 [operator1] chain chainName2 [operator2] ...'
});

const args = parser.parse_args();

if (!fs.existsSync(args.in)) {
    console.error(`Input path "${args.in}" does not exist`);
    process.exit(1);
}

if (!fs.existsSync(args.out)) {
    fs.mkdirSync(args.out, { recursive: true });
}

/**
 * Get file name without extension
 * @param inPath path of file
 */
export function getFileName(inPath: string) {
    const arr = inPath.split(/[\/\\]/);
    return arr[arr.length - 1].split('.')[0];
}

async function main() {
    const renderer = new ImageRenderer(args.width, args.height, args.format, args.plddt, args.save_state, new FocusFirstResidue());

    const fileName = getFileName(args.in);
    const cif = await readCifFile(args.in);
    const trajectory = await getTrajectory(cif as CifFrame);

    switch (args.render) {
        case 'all':
            await renderer.renderAll(trajectory, args.out, fileName);
            break;
        case 'chain':
            await renderer.renderChain(args.chainName, await Task.resolveInContext(trajectory.representative), args.out, fileName);
            break;
        case 'model':
            await renderer.renderModel(+args.modIndex + 1, await Task.resolveInContext(trajectory.getFrameAtIndex(args.modIndex)), args.out, fileName);
            break;
        case 'assembly':
            await renderer.renderAssembly(args.asmIndex, await Task.resolveInContext(trajectory.representative), args.out, fileName);
            break;
        case 'models':
            await renderer.renderModels(trajectory, args.out, fileName);
            break;
        case 'chain-list':
            await renderer.renderChainList(args.asmIndex, args.chainList, await Task.resolveInContext(trajectory.representative), args.out, fileName);
            break;
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
