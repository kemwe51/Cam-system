import { partInputSchema, type PartInput } from '@cam/shared';

export type ImportFormat = 'json' | 'dxf' | 'step';

export interface ImportedPartSource {
  sourceId: string;
  name: string;
  format: ImportFormat;
  mediaType: string;
  content: string;
}

export interface ImportResult {
  status: 'success' | 'not_implemented';
  source: ImportedPartSource;
  part?: PartInput;
  notes: string[];
}

export interface PartImporter {
  readonly format: ImportFormat;
  importPart(source: ImportedPartSource): Promise<ImportResult>;
}

function formatLabel(format: ImportFormat): string {
  return format === 'step' ? 'STEP' : format === 'dxf' ? 'DXF' : 'JSON';
}

function sourceMismatchMessage(expected: ImportFormat, received: ImportFormat): string {
  return `Expected ${formatLabel(expected)} source, received ${formatLabel(received)}.`;
}

export class JsonPartImporter implements PartImporter {
  readonly format = 'json' as const;

  async importPart(source: ImportedPartSource): Promise<ImportResult> {
    if (source.format !== 'json') {
      throw new Error(sourceMismatchMessage(this.format, source.format));
    }

    const parsed = partInputSchema.parse(JSON.parse(source.content));
    return {
      status: 'success',
      source,
      part: parsed,
      notes: ['Structured JSON import succeeded. Geometry remains structured input, not CAD kernel geometry.'],
    };
  }
}

class NotImplementedImporter implements PartImporter {
  constructor(
    public readonly format: ImportFormat,
    private readonly notes: string[],
  ) {}

  async importPart(source: ImportedPartSource): Promise<ImportResult> {
    if (source.format !== this.format) {
      throw new Error(sourceMismatchMessage(this.format, source.format));
    }

    return {
      status: 'not_implemented',
      source,
      notes: this.notes,
    };
  }
}

export const dxfPartImporter = new NotImplementedImporter('dxf', [
  'DXF import adapter boundary is defined, but DXF parsing and feature extraction are not implemented yet.',
  'TODO: map DXF entities into deterministic 2D profile and hole candidates before planning.',
]);

export const stepPartImporter = new NotImplementedImporter('step', [
  'STEP import adapter boundary is defined, but STEP B-Rep ingestion is not implemented yet.',
  'TODO: connect a real geometry/model kernel before claiming STEP-derived machining support.',
]);
