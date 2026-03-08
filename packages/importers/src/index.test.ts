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

  it('returns structured placeholder responses for DXF and STEP adapters', async () => {
    const dxfResult = await dxfPartImporter.importPart(source('dxf', '0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF'));
    const stepResult = await stepPartImporter.importPart(source('step', 'ISO-10303-21;END-ISO-10303-21;'));

    expect(dxfResult.importStatus).toBe('not_implemented');
    expect(dxfResult.sourceFileName).toBe('sample.dxf');
    expect(dxfResult.warnings.join(' ')).toContain('Actionable next step');
    expect(dxfResult.importedModel.status).toBe('placeholder');
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
