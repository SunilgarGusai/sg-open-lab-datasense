#!/usr/bin/env python3
"""Independent mathematical oracle. Freeze the generated fixtures; no JS functions imported.

Usage: python scripts/generate_numpy_oracle.py [--verify]
NumPy provides an independently implemented numerical source; oracle inputs and
scientific conventions match SG_DataSense_MVP_Specification_v1.0.md.
"""
import argparse
import json
from pathlib import Path
import math
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/fixtures/numpy-oracle.json'
CASES={
    'basic_1_4': [1,2,3,4],
    'singleton': [10],
    'constant': [5,5,5,5],
    'unimodal': [1,1,2,3],
    'multimodal': [1,1,2,2,3],
    'distinct': [1,2,3],
    'negative': [-10,-5,0,5],
    'zeros': [0,0,2],
    'ties': [2,2,2,3],
    'large_offset': [1000000000000,1000000000001,1000000000002],
    'large_neg_offset': [-1000000000002,-1000000000001,-1000000000000],
    'unbalanced': [2,3,3,3,20,100],
    'noninteger': [1.1,3.7,5.2,9.3],
    'symmetric': [-4,-2,0,2,4],
    'zero_singleton': [0],
    'extremal_mix': [-10.5,-2.5,0,1.25,2.75,100.1],
    'empty': [],
}

def row(data):
    arr=np.asarray(data, dtype=np.float64)
    if len(arr)==0:
        return dict(n=0,sum=None,min=None,max=None,mean=None,median=None,q1=None,q3=None,iqr=None,
                    populationVariance=None,sampleVariance=None, populationStandardDeviation=None,
                    sampleStandardDeviation=None,p10=None,p90=None)
    q=np.quantile(arr, [0.1,0.25,0.5,0.75,0.9], method='linear')
    return {
        'n':len(data),'sum':float(np.sum(arr)), 'min':float(np.min(arr)), 'max':float(np.max(arr)),
        'mean':float(np.mean(arr)), 'median':float(q[2]), 'q1':float(q[1]),'q3':float(q[3]),
        'iqr':float(q[3]-q[1]),'populationVariance':float(np.var(arr,ddof=0)),
        'sampleVariance':float(np.var(arr,ddof=1)) if len(arr)>1 else None,
        'populationStandardDeviation':float(np.std(arr,ddof=0)),
        'sampleStandardDeviation':float(np.std(arr,ddof=1)) if len(arr)>1 else None,
        'p10':float(q[0]),'p90':float(q[4])
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--verify',action='store_true')
    args=parser.parse_args()
    fixture={'method':'numpy.quantile(method=linear), numpy.var(ddof=0 or 1)',
             'floating_point':'binary64','cases':{name:{'data':data,'expected':row(data)} for name,data in CASES.items()}}
    if args.verify:
        actual=json.loads(OUT.read_text())
        if actual!=fixture:
            # Avoid equating a transient package upgrade with a mathematical failure:
            # the frozen oracle must remain stable under the pinned method.
            raise SystemExit('Oracle comparison FAILED. Investigate NumPy version/definition differences.')
        print(f'Oracle verified: {len(CASES)} NumPy cases.')
    else:
        OUT.write_text(json.dumps(fixture,indent=2,ensure_ascii=False)+'\n')
        print(f'Wrote {OUT}: {len(CASES)} cases (numpy={np.__version__}).')

if __name__=='__main__':
    main()
