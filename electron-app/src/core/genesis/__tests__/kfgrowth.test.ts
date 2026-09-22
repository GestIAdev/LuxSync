import { describe, it } from 'vitest'
import { applyOperator } from '../operators/GeneticOperators'
import { DEFAULT_COGNITIVE_DNA } from '../../hephaestus/defaults'
import type { HephAutomationClipV3 } from '../../hephaestus/types'

const OPS = ['focal_mutation','gene_augmentation','spatial_resonance','proportional_stretch','macro_splice','adaptive_pruning','curve_adaptation','color_hue_shift'] as const

function baseClip(): HephAutomationClipV3 {
  return {
    id:'t',name:'t',author:'',category:'composite',tags:[],vibeCompat:[],
    spatialZones:['front'],mixBus:'global',priority:0,durationMs:4000,
    effectType:'custom',schemaVersion:'3.0',
    cognitiveDNA:{ ...DEFAULT_COGNITIVE_DNA, genome:{aggression:0.9,chaos:0.9,organicity:0.5} } as any,
    staticParams:{},
    tracks:[
      {id:'t1',paramId:'intensity',zones:['front'],curve:{paramId:'intensity',valueType:'number',range:[0,255],defaultValue:0,mode:'absolute',keyframes:[{timeMs:0,value:0,interpolation:'linear'},{timeMs:4000,value:255,interpolation:'linear'}]}},
      {id:'t2',paramId:'strobe',zones:['front'],curve:{paramId:'strobe',valueType:'number',range:[0,255],defaultValue:0,mode:'absolute',keyframes:[{timeMs:0,value:0,interpolation:'hold'},{timeMs:2000,value:255,interpolation:'hold'},{timeMs:4000,value:0,interpolation:'hold'}]}},
    ] as any,
  } as any
}

function stats(c: HephAutomationClipV3) {
  let kf=0,max=0
  for (const t of c.tracks){const n=t.curve.keyframes.length;kf+=n;if(n>max)max=n}
  return {tracks:c.tracks.length,kf,max}
}

describe('keyframe growth', () => {
  it('measures worst-case accumulation', () => {
    for (const forced of OPS) {
      let clip = baseClip()
      for (let g=0; g<16; g++) clip = applyOperator(clip, forced as any, 12345+g).clip
      console.log(`op=${forced.padEnd(22)}`, JSON.stringify(stats(clip)))
    }
    let m = baseClip()
    for (let g=0; g<32; g++) m = applyOperator(m,'macro_splice',g*7).clip
    console.log('32x macro_splice', JSON.stringify(stats(m)))
    let a = baseClip()
    for (let g=0; g<32; g++) a = applyOperator(a,'gene_augmentation',g*13).clip
    console.log('32x gene_aug    ', JSON.stringify(stats(a)))
    let mixed = baseClip()
    for (let g=0; g<48; g++) mixed = applyOperator(mixed, OPS[g%OPS.length] as any, g*31).clip
    console.log('48x rotating    ', JSON.stringify(stats(mixed)))
  })
})
