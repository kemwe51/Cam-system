import { describe, expect, it } from 'vitest';
import { buildGeometryGraph, parseDxfGeometry2D } from './index.js';

const sampleDxf = `0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
OUTER
90
4
70
1
10
0
20
0
10
80
20
0
10
80
20
50
10
0
20
50
0
LWPOLYLINE
8
POCKET
90
4
70
1
10
20
20
10
10
60
20
10
10
60
20
30
10
20
20
30
0
CIRCLE
8
HOLES
10
30
20
20
40
4
0
LINE
8
SCRIBE
10
0
20
60
11
20
21
65
0
SPLINE
8
IGNORED
0
ENDSEC
0
EOF`;

describe('@cam/geometry2d', () => {
  it('parses a practical DXF subset with stable ids, layers, and warnings', () => {
    const document = parseDxfGeometry2D(sampleDxf, 'fixture');

    expect(document.units).toBe('mm');
    expect(document.entities.map((entity) => entity.id)).toEqual([
      'geom-lwpolyline-0001',
      'geom-lwpolyline-0002',
      'geom-circle-0003',
      'geom-line-0004',
      'geom-spline-0005',
    ]);
    expect(document.layers.map((layer) => layer.name)).toEqual(['HOLES', 'IGNORED', 'OUTER', 'POCKET', 'SCRIBE']);
    expect(document.warnings.some((warning) => warning.code === 'unsupported_entity')).toBe(true);
  });

  it('builds graph chains, loops, and open/closed profile sets', () => {
    const document = parseDxfGeometry2D(sampleDxf, 'fixture');
    const graph = buildGeometryGraph(document, 0.01);

    expect(graph.chains.some((chain) => chain.closed)).toBe(true);
    expect(graph.openProfileIds.length).toBe(1);
    expect(graph.closedProfileIds.length).toBeGreaterThanOrEqual(3);
    expect(graph.regions.length).toBeGreaterThan(0);
  });
});
