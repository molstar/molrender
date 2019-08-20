import { Model, Structure, StructureSelection, QueryContext } from 'molstar/lib/mol-model/structure';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';


const structure = Structure.Empty
const models: Model[] = []

// list of all chain names in first model (you can assume that all models are identical)
const chainNames: string[] = []
const { entities } = models[0]
const { label_asym_id, label_entity_id } = models[0].atomicHierarchy.chains
for (let i = 0, il = label_asym_id.rowCount; i < il; ++i) {
    const eI = entities.getEntityIndex(label_entity_id.value(i))
    if (entities.data.type.value(eI) === 'polymer') {
        chainNames.push(label_asym_id.value(i))
    }
}

// create a new structure that has only the chain with name 'A'
const expression = MS.struct.generator.atomGroups({
    'chain-test': MS.core.rel.eq([MS.ammp('label_asym_id'), 'A']),
})
const query = compile<StructureSelection>(expression)
const selection = query(new QueryContext(structure))
const chainStructure = StructureSelection.unionStructure(selection)

// 1abc_assembly-1
// 1abc_model-1 // models[0].modelNum
// 1abc_chain-A


// cartoon for whole structure
// carbohydrates for whole structure

// ball and stick for
MS.struct.modifier.union([
    MS.struct.combinator.merge([ Q.ligandsPlusConnected, Q.branchedConnectedOnly ])
]))


// reiterate what I thought
// So render chains themselves, and also render the chains inside the main thing, but with different representation
// Also we need to know the name of the chains/models and stuff