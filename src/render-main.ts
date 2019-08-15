/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Jesse Liang <jesse.liang@rcsb.org>
 */

import * as commander from 'commander'
// import * as argparse from 'argparse'
import { getArrLengths } from './render-all'

// const parser = new argparse.ArgumentParser({
//     addHelp: true,
//     description: 'Render all models and assemblies of a PDB ID'
// });
// const subparsers = parser.addSubparsers({
//     title: 'subcommands',
//     dest: 'render'
// });

// const modParse = subparsers.addParser('mod', {addHelp: true});
// modParse.addArgument([ '--width' ], {
//     action: 'store',
//     help: 'width of image'
// });
// modParse.addArgument([ '--height' ], {
//     action: 'store',
//     help: 'height of image'
// });
// modParse.addArgument([ '--repr' ], {
//     action: 'store',
//     help: 'cartoon, ballandstick, molecular, gaussian (0, 1, 2, 3)'
// });
// modParse.addArgument([ 'in' ], {
//     action: 'store',
//     help: 'input path of cif file'
// });
// modParse.addArgument([ 'out' ], {
//     action: 'store',
//     help: 'output path of png files (not including file name)'
// });
// modParse.addArgument([ 'modIndex' ], {
//     action: 'store',
//     help: 'model index'
// });

// const asmParse = subparsers.addParser('asm', {addHelp: true})
// asmParse.addArgument([ '--width' ], {
//     action: 'store',
//     help: 'width of image'
// });
// asmParse.addArgument([ '--height' ], {
//     action: 'store',
//     help: 'height of image'
// });
// asmParse.addArgument([ '--repr' ], {
//     action: 'store',
//     help: 'cartoon, ballandstick, molecular, gaussian (0, 1, 2, 3)'
// });
// asmParse.addArgument([ 'in' ], {
//     action: 'store',
//     help: 'input path of cif file'
// });
// asmParse.addArgument([ 'out' ], {
//     action: 'store',
//     help: 'output path of png files (not including file name)'
// });
// asmParse.addArgument([ 'modIndex' ], {
//     action: 'store',
//     help: 'model index'
// });
// asmParse.addArgument([ 'asmIndex' ], {
//     action: 'store',
//     help: 'assembly index'
// });

// const getLenParse = subparsers.addParser('getLen', {addHelp: true})
// getLenParse.addArgument([ 'bool' ], {
//     action: 'store',
//     help: 'true = num of models; false = num of assemblies'
// })
// getLenParse.addArgument([ 'in' ], {
//     action: 'store',
//     help: 'input path of cif file'
// })
// getLenParse.addArgument([ 'modIndex' ], {
//     action: 'store',
//     help: 'model index'
// })

// interface Args {
//     width: number
//     height: number
//     bool: boolean
//     in: string
//     out: string
//     asmIndex: number
//     modIndex: number
//     repr: number
// }

// const args = parser.parseArgs();

let width = 2048
let height = 1536

// if (args.width != null) {
//     width = args.width
// }
// if (args.height != null) {
//     height = args.height
// }


// let rep = 0
// if (args.rep !== null) {
//     rep = args.rep
// }

// let renderer: RenderAll

getArrLengths(true, 0, './examples/1crn.cif')

// switch (args.render) {
//     case 'getLen':
//         getArrLengths(args.bool, args.modIndex, args.in)
//         break;
//     case 'mod':
//         renderer = new RenderAll(width, height)
//         renderer.renderMod(args.modIndex, args.in, args.out, rep)
//         break;
//     case 'asm':
//         renderer = new RenderAll(width, height)
//         renderer.renderAsm(args.modIndex, args.asmIndex, args.in, args.out, rep)
//         break;
// }

// const program = new commander.Command()
// program.version('0.0.1')

// program
//     .command('getlength <bool> <in> <modIndex>')
//     .action(function() {
//     })

// program
//     .command('assembly <in> <out> <modIndex> <asmIndex> [repr]')
//     .alias('asm')
//     .description('render assembly')
//     .option('-w --width <width>', 'width of image')
//     .option('-h --height <height>', 'height of image')

// program
//     .command('model <in> <out> <modIndex> [repr]')
//     .alias('mod')
//     .description('render model')
//     .option('-w --width <width>', 'width of image')
//     .option('-h --height <height>', 'height of image')