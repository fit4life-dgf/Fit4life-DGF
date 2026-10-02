#!/usr/bin/env python3
"""Generates public/models/test/diagnostic-test-model.glb: a tiny, original, box-built figure used ONLY to test the 3D pipeline
(loader, mesh-name mapping, recolouring, layers, animation). It is not anatomy and must never be shown on production screens."""
import json, struct, math, sys

# unit box, 24 vertices with normals
P, N, I = [], [], []
faces = [((1,0,0),[(1,-1,-1),(1,1,-1),(1,1,1),(1,-1,1)]), ((-1,0,0),[(-1,-1,1),(-1,1,1),(-1,1,-1),(-1,-1,-1)]),
         ((0,1,0),[(-1,1,-1),(-1,1,1),(1,1,1),(1,1,-1)]), ((0,-1,0),[(-1,-1,1),(-1,-1,-1),(1,-1,-1),(1,-1,1)]),
         ((0,0,1),[(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]), ((0,0,-1),[(1,-1,-1),(-1,-1,-1),(-1,1,-1),(1,1,-1)])]
for n, vs in faces:
    b = len(P)
    for v in vs: P.append(tuple(c * 0.5 for c in v)); N.append(n)
    I += [b, b+1, b+2, b, b+2, b+3]

pos = b''.join(struct.pack('<3f', *p) for p in P)
nor = b''.join(struct.pack('<3f', *n) for n in N)
idx = b''.join(struct.pack('<H', i) for i in I)
times = struct.pack('<3f', 0.0, 1.0, 2.0)
def quat_x(deg): a = math.radians(deg) / 2; return (math.sin(a), 0.0, 0.0, math.cos(a))
rep = b''.join(struct.pack('<4f', *quat_x(d)) for d in (0, -70, 0))
slow = b''.join(struct.pack('<4f', *quat_x(d)) for d in (0, 35, 0))
blob = pos + nor + idx + times + rep + slow
views = [(0, len(pos), 34962), (len(pos), len(nor), 34962), (len(pos)+len(nor), len(idx), 34963),
         (len(pos)+len(nor)+len(idx), len(times), None), (len(pos)+len(nor)+len(idx)+len(times), len(rep), None),
         (len(pos)+len(nor)+len(idx)+len(times)+len(rep), len(slow), None)]
bufferViews = []
for o, l, t in views:
    v = {"buffer": 0, "byteOffset": o, "byteLength": l}
    if t: v["target"] = t
    bufferViews.append(v)
accessors = [
  {"bufferView": 0, "componentType": 5126, "count": 24, "type": "VEC3", "min": [-0.5]*3, "max": [0.5]*3},
  {"bufferView": 1, "componentType": 5126, "count": 24, "type": "VEC3"},
  {"bufferView": 2, "componentType": 5123, "count": 36, "type": "SCALAR"},
  {"bufferView": 3, "componentType": 5126, "count": 3, "type": "SCALAR", "min": [0.0], "max": [2.0]},
  {"bufferView": 4, "componentType": 5126, "count": 3, "type": "VEC4"},
  {"bufferView": 5, "componentType": 5126, "count": 3, "type": "VEC4"},
]
mat = lambda n, c: {"name": n, "pbrMetallicRoughness": {"baseColorFactor": c, "metallicFactor": 0.0, "roughnessFactor": 0.8}}
materials = [mat("test_muscle", [0.8, 0.5, 0.5, 1]), mat("test_skin", [0.9, 0.75, 0.65, 1]), mat("test_bone", [0.9, 0.9, 0.85, 1])]
# name, translation, scale, material  (1.8 units tall, built from boxes; deliberately NOT anatomical)
parts = [
  ("Skin_Body", (0, 0.0, 0), (0.62, 1.8, 0.34), 1),
  ("Skeleton_Spine", (0, 0.1, -0.02), (0.08, 1.0, 0.08), 2),
  ("Skeleton_Femur_L", (0.12, -0.55, 0), (0.07, 0.6, 0.07), 2),
  ("Skeleton_Femur_R", (-0.12, -0.55, 0), (0.07, 0.6, 0.07), 2),
  ("muscle_pectoralis_major_L", (0.12, 0.4, 0.14), (0.2, 0.18, 0.08), 0),
  ("muscle_pectoralis_major_R", (-0.12, 0.4, 0.14), (0.2, 0.18, 0.08), 0),
  ("muscle_rectus_abdominis", (0, 0.1, 0.15), (0.16, 0.4, 0.06), 0),
  ("muscle_deltoid_anterior_L", (0.3, 0.5, 0.1), (0.1, 0.14, 0.1), 0),
  ("muscle_deltoid_anterior_R", (-0.3, 0.5, 0.1), (0.1, 0.14, 0.1), 0),
  ("muscle_triceps_brachii_L", (0.31, 0.25, -0.05), (0.09, 0.3, 0.09), 0),
  ("muscle_triceps_brachii_R", (-0.31, 0.25, -0.05), (0.09, 0.3, 0.09), 0),
  ("muscle_quadriceps_L", (0.12, -0.5, 0.08), (0.18, 0.6, 0.14), 0),
  ("muscle_quadriceps_R", (-0.12, -0.5, 0.08), (0.18, 0.6, 0.14), 0),
  ("muscle_biceps_brachii_L", (0.31, 0.25, 0.06), (0.09, 0.3, 0.09), 0),
  ("muscle_biceps_brachii_R", (-0.31, 0.25, 0.06), (0.09, 0.3, 0.09), 0),
]
nodes, meshes, scene_nodes = [], [], []
for i, (name, t, s, m) in enumerate(parts):
    meshes.append({"name": name, "primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": m}]})
    nodes.append({"name": name, "mesh": i, "translation": list(t), "scale": list(s)})
    scene_nodes.append(i)
target = [p[0] for p in parts].index("muscle_biceps_brachii_L")
gltf = {
  "asset": {"version": "2.0", "generator": "scripts/make_test_glb.py"},
  "scene": 0, "scenes": [{"name": "diagnostic-test-model", "nodes": scene_nodes}],
  "nodes": nodes, "meshes": meshes, "materials": materials, "accessors": accessors, "bufferViews": bufferViews,
  "buffers": [{"byteLength": len(blob)}],
  "animations": [
    {"name": "TestRep", "samplers": [{"input": 3, "output": 4, "interpolation": "LINEAR"}], "channels": [{"sampler": 0, "target": {"node": target, "path": "rotation"}}]},
    {"name": "TestSlow", "samplers": [{"input": 3, "output": 5, "interpolation": "LINEAR"}], "channels": [{"sampler": 0, "target": {"node": target, "path": "rotation"}}]},
  ],
}
js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
blob += b'\0' * (-len(blob) % 4)
gltf["buffers"][0]["byteLength"] = len(blob)
js = json.dumps(gltf, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
out = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(blob), b'BIN\0') + blob
path = sys.argv[1] if len(sys.argv) > 1 else 'public/models/test/diagnostic-test-model.glb'
open(path, 'wb').write(out)
print('wrote', path, len(out), 'bytes')
