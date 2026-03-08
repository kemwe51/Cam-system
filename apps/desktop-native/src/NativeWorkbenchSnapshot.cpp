#include "NativeWorkbenchSnapshot.hpp"

#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>

namespace {

QStringList readStringArray(const QJsonArray& values) {
  QStringList result;
  result.reserve(values.size());
  for (const auto& value : values) {
    if (value.isString()) {
      result.push_back(value.toString());
    }
  }
  return result;
}

QMap<QString, QString> readStringMap(const QJsonObject& object) {
  QMap<QString, QString> result;
  for (auto iterator = object.begin(); iterator != object.end(); ++iterator) {
    result.insert(iterator.key(), iterator.value().toString());
  }
  return result;
}

QList<NativeWorkbenchTopologyRef> readTopologyRefs(const QJsonArray& values) {
  QList<NativeWorkbenchTopologyRef> refs;
  refs.reserve(values.size());
  for (const auto& value : values) {
    if (!value.isObject()) {
      continue;
    }

    const auto object = value.toObject();
    refs.push_back({
      .id = object.value(QStringLiteral("id")).toString(),
      .system = object.value(QStringLiteral("system")).toString(),
      .entityType = object.value(QStringLiteral("entityType")).toString(),
      .persistentId = object.value(QStringLiteral("persistentId")).toString(),
      .label = object.value(QStringLiteral("label")).toString(),
    });
  }
  return refs;
}

std::optional<NativeWorkbenchSnapshot> parseSnapshot(const QJsonDocument& document, QString* errorMessage) {
  if (!document.isObject()) {
    if (errorMessage != nullptr) {
      *errorMessage = QStringLiteral("Native workbench snapshot root must be a JSON object.");
    }
    return std::nullopt;
  }

  const auto root = document.object();
  const auto schemaVersion = root.value(QStringLiteral("schemaVersion")).toString();
  if (schemaVersion != QStringLiteral("native-workbench-v1")) {
    if (errorMessage != nullptr) {
      *errorMessage = QStringLiteral("Unsupported native workbench snapshot schema: %1").arg(schemaVersion);
    }
    return std::nullopt;
  }

  NativeWorkbenchSnapshot snapshot;
  snapshot.schemaVersion = schemaVersion;
  snapshot.projectId = root.value(QStringLiteral("projectId")).toString();
  snapshot.revision = root.value(QStringLiteral("revision")).toInt();
  snapshot.approvalState = root.value(QStringLiteral("approvalState")).toString();
  snapshot.sourceType = root.value(QStringLiteral("sourceType")).toString();
  snapshot.sourceImportId = root.value(QStringLiteral("sourceImportId")).toString();
  snapshot.importedModelId = root.value(QStringLiteral("importedModelId")).toString();
  snapshot.warnings = readStringArray(root.value(QStringLiteral("warnings")).toArray());

  const auto metadata = root.value(QStringLiteral("metadata")).toObject();
  snapshot.metadata = {
    .featureCount = metadata.value(QStringLiteral("featureCount")).toInt(),
    .extractedFeatureCount = metadata.value(QStringLiteral("extractedFeatureCount")).toInt(),
    .operationCount = metadata.value(QStringLiteral("operationCount")).toInt(),
    .toolCount = metadata.value(QStringLiteral("toolCount")).toInt(),
    .toolpathCandidateCount = metadata.value(QStringLiteral("toolpathCandidateCount")).toInt(),
    .previewCount = metadata.value(QStringLiteral("previewCount")).toInt(),
    .resolvedLinkCount = metadata.value(QStringLiteral("resolvedLinkCount")).toInt(),
    .partialLinkCount = metadata.value(QStringLiteral("partialLinkCount")).toInt(),
    .unresolvedLinkCount = metadata.value(QStringLiteral("unresolvedLinkCount")).toInt(),
    .hasPlaceholderModel = metadata.value(QStringLiteral("hasPlaceholderModel")).toBool(),
  };

  const auto nodeValues = root.value(QStringLiteral("nodes")).toArray();
  snapshot.nodes.reserve(nodeValues.size());
  for (const auto& value : nodeValues) {
    if (!value.isObject()) {
      continue;
    }

    const auto object = value.toObject();
    snapshot.nodes.push_back({
      .id = object.value(QStringLiteral("id")).toString(),
      .stableId = object.value(QStringLiteral("stableId")).toString(),
      .kind = object.value(QStringLiteral("kind")).toString(),
      .label = object.value(QStringLiteral("label")).toString(),
      .parentId = object.value(QStringLiteral("parentId")).toString(),
      .status = object.value(QStringLiteral("status")).toString(),
      .visibility = object.value(QStringLiteral("visibility")).toString(QStringLiteral("visible")),
      .entityId = object.value(QStringLiteral("entityId")).toString(),
      .featureId = object.value(QStringLiteral("featureId")).toString(),
      .operationId = object.value(QStringLiteral("operationId")).toString(),
      .toolId = object.value(QStringLiteral("toolId")).toString(),
      .previewId = object.value(QStringLiteral("previewId")).toString(),
      .sourceGeometryIds = readStringArray(object.value(QStringLiteral("sourceGeometryIds")).toArray()),
      .metadata = readStringMap(object.value(QStringLiteral("metadata")).toObject()),
    });
  }

  const auto selectionLinkValues = root.value(QStringLiteral("selectionLinks")).toArray();
  snapshot.selectionLinks.reserve(selectionLinkValues.size());
  for (const auto& value : selectionLinkValues) {
    if (!value.isObject()) {
      continue;
    }

    const auto object = value.toObject();
    snapshot.selectionLinks.push_back({
      .id = object.value(QStringLiteral("id")).toString(),
      .syncChannels = readStringArray(object.value(QStringLiteral("syncChannels")).toArray()),
      .modelEntityNodeId = object.value(QStringLiteral("modelEntityNodeId")).toString(),
      .featureNodeId = object.value(QStringLiteral("featureNodeId")).toString(),
      .operationNodeId = object.value(QStringLiteral("operationNodeId")).toString(),
      .toolNodeId = object.value(QStringLiteral("toolNodeId")).toString(),
      .toolpathNodeId = object.value(QStringLiteral("toolpathNodeId")).toString(),
      .previewNodeId = object.value(QStringLiteral("previewNodeId")).toString(),
      .sourceGeometryIds = readStringArray(object.value(QStringLiteral("sourceGeometryIds")).toArray()),
      .topologyRefs = readTopologyRefs(object.value(QStringLiteral("topologyRefs")).toArray()),
      .resolution = object.value(QStringLiteral("resolution")).toString(QStringLiteral("resolved")),
      .warnings = readStringArray(object.value(QStringLiteral("warnings")).toArray()),
    });
  }

  const auto linkMappingValues = root.value(QStringLiteral("linkMappings")).toArray();
  snapshot.linkMappings.reserve(linkMappingValues.size());
  for (const auto& value : linkMappingValues) {
    if (!value.isObject()) {
      continue;
    }

    const auto object = value.toObject();
    snapshot.linkMappings.push_back({
      .id = object.value(QStringLiteral("id")).toString(),
      .entityId = object.value(QStringLiteral("entityId")).toString(),
      .featureId = object.value(QStringLiteral("featureId")).toString(),
      .operationId = object.value(QStringLiteral("operationId")).toString(),
      .toolId = object.value(QStringLiteral("toolId")).toString(),
      .toolpathCandidateId = object.value(QStringLiteral("toolpathCandidateId")).toString(),
      .previewId = object.value(QStringLiteral("previewId")).toString(),
      .sourceGeometryIds = readStringArray(object.value(QStringLiteral("sourceGeometryIds")).toArray()),
      .topologyRefs = readTopologyRefs(object.value(QStringLiteral("topologyRefs")).toArray()),
      .resolution = object.value(QStringLiteral("resolution")).toString(),
      .warnings = readStringArray(object.value(QStringLiteral("warnings")).toArray()),
    });
  }

  const auto displayLayerValues = root.value(QStringLiteral("displayLayers")).toArray();
  snapshot.displayLayers.reserve(displayLayerValues.size());
  for (const auto& value : displayLayerValues) {
    if (!value.isObject()) {
      continue;
    }

    const auto object = value.toObject();
    snapshot.displayLayers.push_back({
      .id = object.value(QStringLiteral("id")).toString(),
      .label = object.value(QStringLiteral("label")).toString(),
      .kind = object.value(QStringLiteral("kind")).toString(),
      .visible = object.value(QStringLiteral("visible")).toBool(true),
      .status = object.value(QStringLiteral("status")).toString(QStringLiteral("ready")),
    });
  }

  if (snapshot.projectId.isEmpty()) {
    if (errorMessage != nullptr) {
      *errorMessage = QStringLiteral("Native workbench snapshot is missing projectId.");
    }
    return std::nullopt;
  }

  return snapshot;
}

}  // namespace

const NativeWorkbenchNode* NativeWorkbenchSnapshot::findNodeById(const QString& nodeId) const {
  for (const auto& node : nodes) {
    if (node.id == nodeId) {
      return &node;
    }
  }
  return nullptr;
}

const NativeWorkbenchSelectionLink* NativeWorkbenchSnapshot::findSelectionLinkForNode(const QString& nodeId) const {
  for (const auto& link : selectionLinks) {
    if (link.modelEntityNodeId == nodeId
        || link.featureNodeId == nodeId
        || link.operationNodeId == nodeId
        || link.toolNodeId == nodeId
        || link.toolpathNodeId == nodeId
        || link.previewNodeId == nodeId) {
      return &link;
    }
  }
  return nullptr;
}

QString NativeWorkbenchSnapshot::summaryLine() const {
  return QStringLiteral("features %1 · operations %2 · toolpaths %3 · tools %4 · link coverage %5/%6/%7")
    .arg(metadata.featureCount)
    .arg(metadata.operationCount)
    .arg(metadata.toolpathCandidateCount)
    .arg(metadata.toolCount)
    .arg(metadata.resolvedLinkCount)
    .arg(metadata.partialLinkCount)
    .arg(metadata.unresolvedLinkCount);
}

std::optional<NativeWorkbenchSnapshot> NativeWorkbenchSnapshotReader::loadFromFile(const QString& filePath, QString* errorMessage) {
  QFile file(filePath);
  if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
    if (errorMessage != nullptr) {
      *errorMessage = QStringLiteral("Unable to open native workbench snapshot: %1").arg(filePath);
    }
    return std::nullopt;
  }

  QJsonParseError parseError;
  const auto document = QJsonDocument::fromJson(file.readAll(), &parseError);
  if (parseError.error != QJsonParseError::NoError) {
    if (errorMessage != nullptr) {
      *errorMessage = QStringLiteral("Unable to parse native workbench snapshot: %1").arg(parseError.errorString());
    }
    return std::nullopt;
  }

  return parseSnapshot(document, errorMessage);
}
