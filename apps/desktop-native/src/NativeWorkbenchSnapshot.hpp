#pragma once

#include <QList>
#include <QMap>
#include <QMetaType>
#include <QString>
#include <QStringList>

#include <optional>

struct NativeWorkbenchTopologyRef {
  QString id;
  QString system;
  QString entityType;
  QString persistentId;
  QString label;
};

struct NativeWorkbenchNode {
  QString id;
  QString stableId;
  QString kind;
  QString label;
  QString parentId;
  QString status;
  QString visibility;
  QString entityId;
  QString featureId;
  QString operationId;
  QString toolId;
  QString previewId;
  QStringList sourceGeometryIds;
  QMap<QString, QString> metadata;
};

struct NativeWorkbenchSelectionLink {
  QString id;
  QStringList syncChannels;
  QString modelEntityNodeId;
  QString featureNodeId;
  QString operationNodeId;
  QString toolNodeId;
  QString previewNodeId;
  QStringList sourceGeometryIds;
  QList<NativeWorkbenchTopologyRef> topologyRefs;
  QString resolution;
  QStringList warnings;
};

struct NativeWorkbenchLinkMapping {
  QString id;
  QString entityId;
  QString featureId;
  QString operationId;
  QString toolId;
  QString previewId;
  QStringList sourceGeometryIds;
  QList<NativeWorkbenchTopologyRef> topologyRefs;
  QString resolution;
  QStringList warnings;
};

struct NativeWorkbenchDisplayLayer {
  QString id;
  QString label;
  QString kind;
  bool visible = true;
  QString status;
};

struct NativeWorkbenchSnapshotMetadata {
  int featureCount = 0;
  int extractedFeatureCount = 0;
  int operationCount = 0;
  int toolCount = 0;
  int previewCount = 0;
  int resolvedLinkCount = 0;
  int partialLinkCount = 0;
  int unresolvedLinkCount = 0;
  bool hasPlaceholderModel = false;
};

struct NativeWorkbenchSnapshot {
  QString schemaVersion;
  QString projectId;
  int revision = 0;
  QString approvalState;
  QString sourceType;
  QString sourceImportId;
  QString importedModelId;
  QStringList warnings;
  QList<NativeWorkbenchNode> nodes;
  QList<NativeWorkbenchSelectionLink> selectionLinks;
  QList<NativeWorkbenchLinkMapping> linkMappings;
  QList<NativeWorkbenchDisplayLayer> displayLayers;
  NativeWorkbenchSnapshotMetadata metadata;

  [[nodiscard]] const NativeWorkbenchNode* findNodeById(const QString& nodeId) const;
  [[nodiscard]] const NativeWorkbenchSelectionLink* findSelectionLinkForNode(const QString& nodeId) const;
  [[nodiscard]] QString summaryLine() const;
};

class NativeWorkbenchSnapshotReader {
public:
  static std::optional<NativeWorkbenchSnapshot> loadFromFile(const QString& filePath, QString* errorMessage = nullptr);
};

Q_DECLARE_METATYPE(NativeWorkbenchNode)
