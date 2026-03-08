import { describe, expect, it } from 'vitest';
import { samplePartInput } from '@cam/shared';
import {
  JsonPartImporter,
  createImporterRegistry,
  defaultImporterRegistry,
  dxfPartImporter,
  stepPartImporter,
  type ImportedPartSource,
} from './index.js';

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
SPLINE
8
IGNORED
0
ENDSEC
0
EOF`;

function source(fileType: ImportedPartSource['fileType'], content: string, fileName = `sample.${fileType}`): ImportedPartSource {
  return {
    sourceId: `${fileType}-source`,
    fileName,
    fileType,
    mediaType: fileType === 'json' ? 'application/json' : 'application/octet-stream',
    content,
  };
}

describe('importers', () => {
  it('imports structured JSON part payloads with derived model metadata', async () => {
    const importer = new JsonPartImporter();
    const result = await importer.importPart(source('json', JSON.stringify(samplePartInput)));

    expect(result.importStatus).toBe('success');
    expect(result.deterministicPartInput?.partId).toBe(samplePartInput.partId);
    expect(result.importedModel.status).toBe('derived');
    expect(result.importedModel.entities.some((entity) => entity.kind === 'stock')).toBe(true);
    expect(result.warnings[0]).toContain('Structured JSON import succeeded');
  });

  it('imports a practical DXF subset and preserves unsupported-entity warnings', async () => {
    const dxfResult = await dxfPartImporter.importPart(source('dxf', sampleDxf));
    const stepResult = await stepPartImporter.importPart(source('step', 'ISO-10303-21;END-ISO-10303-21;'));

    expect(dxfResult.importStatus).toBe('success');
    expect(dxfResult.sourceFileName).toBe('sample.dxf');
    expect(dxfResult.warnings.join(' ')).toContain('Unsupported entities');
    expect(dxfResult.importedModel.status).toBe('derived');
    expect(dxfResult.importedModel.geometryDocument?.entities.length).toBeGreaterThan(0);
    expect(dxfResult.importedModel.extractedFeatures.some((feature) => feature.kind === 'outside_contour')).toBe(true);
    expect(dxfResult.deterministicPartInput?.contours.length).toBeGreaterThan(0);
    expect(stepResult.importStatus).toBe('not_implemented');
    expect(stepResult.importedModel.source.type).toBe('step');
    expect(stepResult.warnings.join(' ')).toContain('real geometry kernel');
  });

  it('uses the registry to resolve importers by file type', async () => {
    const registry = createImporterRegistry();
    const jsonResult = await registry.importPart(source('json', JSON.stringify(samplePartInput), 'fixture.json'));

    expect(defaultImporterRegistry.getImporter('json').format).toBe('json');
    expect(registry.getImporter('dxf')).toBe(dxfPartImporter);
    expect(jsonResult.sourceFileName).toBe('fixture.json');
    expect(jsonResult.importedModel.source.filename).toBe('fixture.json');
  });
});
