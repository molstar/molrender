/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Jesse Liang <jesse.liang@rcsb.org>
 */

import * as argparse from 'argparse'
import { RenderAll, getArrLengths, getChnNames } from './render-all'

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
modParse.addArgument([ '--repr' ], {
    action: 'store',
    help: 'cartoon, ballandstick, molecular, gaussian (0, 1, 2, 3)'
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
asmParse.addArgument([ '--repr' ], {
    action: 'store',
    help: 'cartoon, ballandstick, molecular, gaussian (0, 1, 2, 3)'
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
chnParse.addArgument([ '--repr' ], {
    action: 'store',
    help: 'cartoon, ballandstick, molecular, gaussian (0, 1, 2, 3)'
});
chnParse.addArgument([ 'in' ], {
    action: 'store',
    help: 'input path of cif file'
});
chnParse.addArgument([ 'out' ], {
    action: 'store',
    help: 'output path of png files (not including file name)'
});
chnParse.addArgument([ 'chnName' ], {
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
combParse.addArgument([ 'modIndex' ], {
    action: 'store',
    help: 'model index'
});
combParse.addArgument([ 'asmIndex' ], {
    action: 'store',
    help: 'assembly index'
});

const getLenParse = subparsers.addParser('getlen', {addHelp: true})
getLenParse.addArgument([ 'in' ], {
    action: 'store',
    help: 'input path of cif file'
})
getLenParse.addArgument([ 'modIndex' ], {
    action: 'store',
    help: 'model index'
})

const getNamesParse = subparsers.addParser('getNames', {addHelp: true})
getNamesParse.addArgument([ 'in' ], {
    action: 'store',
    help: 'input path of cif file'
})

const args = parser.parseArgs();

let width = 2048
let height = 1536

if (args.width != null) {
    width = args.width
}
if (args.height != null) {
    height = args.height
}

let rep = 0
if (args.rep !== null) {
    rep = args.rep
}

let renderer: RenderAll

switch (args.render) {
    case 'getlen':
        getArrLengths(args.modIndex, args.in)
        break;
    case 'getNames':
        getChnNames(args.in)
        break;
    case 'comb':
        renderer = new RenderAll(width, height)
        renderer.renderComb(args.modIndex, args.asmIndex, args.in, args.out)
        break
    case 'chn':
        renderer = new RenderAll(width, height)
        renderer.renderChn(args.chnName, args.in, args.out, 250)
        break;
    case 'mod':
        renderer = new RenderAll(width, height)
        renderer.renderMod(args.modIndex, args.in, args.out, rep)
        break;
    case 'asm':
        renderer = new RenderAll(width, height)
        renderer.renderAsm(args.modIndex, args.asmIndex, args.in, args.out, rep)
        break;
}