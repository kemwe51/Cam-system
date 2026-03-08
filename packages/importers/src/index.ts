import {
  createModelSource,
  createPlaceholderImportedModel,
  deriveImportedModelFromPart,
  importedModelSchema,
  modelSourceSchema,
  type ImportedModel,
  type ModelSource,
} from '@cam/model';
import { partInputSchema, type PartInput } from '@cam/shared';

export type ImportFormat = 'json' | 'dxf' | 'step';
export type ImportStatus = 'success' | 'not_implemented';

export interface ImportedPartSource {
  sourceId: string;
  fileName: string;
  fileType: ImportFormat;
  mediaType: string;
  content: string;
  sizeBytes?: number;
}

export interface ImportResult {
  importStatus: ImportStatus;
  sourceFileType: ImportFormat;
  sourceFileName: string;
  source: ModelSource;
  warnings: string[];
  importedModel: ImportedModel;
  deterministicPartInput?: PartInput;
}

export interface PartImporter {
  readonly format: ImportFormat;
  importPart(source: ImportedPartSource): Promise<ImportResult>;
}

export interface ImporterRegistry {
  getImporter(format: ImportFormat): PartImporter;
  importPart(source: ImportedPartSource): Promise<ImportResult>;
}

function formatLabel(format: ImportFormat): string {
  return format === 'step' ? 'STEP' : format === 'dxf' ? 'DXF' : 'JSON';
}

function sourceMismatchMessage(expected: ImportFormat, received: ImportFormat): string {
  return `Expected ${formatLabel(expected)} source, received ${formatLabel(received)}.`;
}

function modelSource(source: ImportedPartSource, sourceGeometryMetadata: string[] = []): ModelSource {
  return modelSourceSchema.parse(
    createModelSource({
      id: source.sourceId,
      type: source.fileType,
      filename: source.fileName,
      mediaType: source.mediaType,
      sizeBytes: source.sizeBytes ?? Buffer.byteLength(source.content, 'utf8'),
      sourceGeometryMetadata,
    }),
  );
}

export class JsonPartImporter implements PartImporter {
  readonly format = 'json' as const;

  async importPart(source: ImportedPartSource): Promise<ImportResult> {
    if (source.fileType !== 'json') {
      throw new Error(sourceMismatchMessage(this.format, source.fileType));
    }

    const parsed = partInputSchema.parse(JSON.parse(source.content));
    const warnings = ['Structured JSON import succeeded. Geometry remains derived metadata, not CAD kernel geometry.'];
    const importedModel = importedModelSchema.parse(
      deriveImportedModelFromPart(
        modelSource(source, ['Structured JSON part payload validated against the shared schema.']),
        parsed,
        warnings,
      ),
    );

    return {
      importStatus: 'success',
      sourceFileType: source.fileType,
      sourceFileName: source.fileName,
      source: importedModel.source,
      warnings,
      importedModel,
      deterministicPartInput: parsed,
    };
  }
}

class NotImplementedImporter implements PartImporter {
  constructor(
    public readonly format: ImportFormat,
    private readonly warnings: string[],
  ) {}

  async importPart(source: ImportedPartSource): Promise<ImportResult> {
    if (source.fileType !== this.format) {
      throw new Error(sourceMismatchMessage(this.format, source.fileType));
    }

    const sourceModel = modelSource(source, ['Workflow placeholder session created. Real parser integration remains pending.']);
    return {
      importStatus: 'not_implemented',
      sourceFileType: source.fileType,
      sourceFileName: source.fileName,
      source: sourceModel,
      warnings: this.warnings,
      importedModel: createPlaceholderImportedModel(sourceModel, this.warnings[0] ?? 'Importer not implemented yet.'),
    };
  }
}

export const dxfPartImporter = new NotImplementedImporter('dxf', [
  'DXF import is not implemented yet. This session only records file metadata and the future workflow boundary.',
  'Actionable next step: parse DXF entities into closed/open 2D profiles, hole centers, layers, and deterministic feature candidates.',
]);

export const stepPartImporter = new NotImplementedImporter('step', [
  'STEP import is not implemented yet. This session only records file metadata and the future workflow boundary.',
  'Actionable next step: connect a real geometry kernel for STEP topology, persistent face ids, and feature graph derivation before claiming machining support.',
]);

export function createImporterRegistry(importers: PartImporter[] = [new JsonPartImporter(), dxfPartImporter, stepPartImporter]): ImporterRegistry {
  const byFormat = new Map(importers.map((importer) => [importer.format, importer]));
  return {
    getImporter(format) {
      const importer = byFormat.get(format);
      if (!importer) {
        throw new Error(`No importer registered for ${format}.`);
      }
      return importer;
    },
    importPart(source) {
      return this.getImporter(source.fileType).importPart(source);
    },
  };
}

export const defaultImporterRegistry = createImporterRegistry();
