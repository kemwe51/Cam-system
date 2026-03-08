import { describe, expect, it } from 'vitest';
import { samplePartInput } from '@cam/shared';
import { JsonPartImporter, dxfPartImporter, stepPartImporter, type ImportedPartSource } from './index.js';

function source(format: ImportedPartSource['format'], content: string): ImportedPartSource {
  return {
    sourceId: `${format}-source`,
    name: `sample.${format}`,
    format,
    mediaType: format === 'json' ? 'application/json' : 'application/octet-stream',
    content,
  };
}

describe('importers', () => {
  it('imports structured JSON part payloads', async () => {
    const importer = new JsonPartImporter();
    const result = await importer.importPart(source('json', JSON.stringify(samplePartInput)));

    expect(result.status).toBe('success');
    expect(result.part?.partId).toBe(samplePartInput.partId);
    expect(result.notes[0]).toContain('Structured JSON import succeeded');
  });

  it('returns honest placeholder responses for DXF and STEP adapters', async () => {
    const dxfResult = await dxfPartImporter.importPart(source('dxf', '0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF'));
    const stepResult = await stepPartImporter.importPart(source('step', 'ISO-10303-21;END-ISO-10303-21;'));

    expect(dxfResult.status).toBe('not_implemented');
    expect(dxfResult.notes.join(' ')).toContain('not implemented yet');
    expect(stepResult.status).toBe('not_implemented');
    expect(stepResult.notes.join(' ')).toContain('real geometry/model kernel');
  });
});
