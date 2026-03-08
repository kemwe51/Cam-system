#include "ProjectFileService.hpp"

#include <QFile>
#include <QFileDialog>
#include <QJsonDocument>
#include <QJsonObject>
#include <QWidget>
#include <stdexcept>

namespace {
constexpr auto kProjectFilter = "CAM desktop project (*.camproj.json);;JSON files (*.json)";
constexpr auto kStepFilter = "STEP models (*.step *.stp);;All files (*)";
constexpr auto kDxfFilter = "DXF drawings (*.dxf);;All files (*)";
}

QString WorkbenchProjectDocument::title() const {
  return projectId.isEmpty() ? displayName : QStringLiteral("%1 — %2").arg(displayName, projectId);
}

WorkbenchProjectDocument ProjectFileService::createEmpty() {
  WorkbenchProjectDocument document;
  document.metadata.insert(QStringLiteral("bridgeSchema"), QStringLiteral("native-workbench-v1"));
  document.metadata.insert(QStringLiteral("bridgeRole"), QStringLiteral("desktop-shell-consumer"));
  return document;
}

WorkbenchProjectDocument ProjectFileService::load(const QString& filePath) {
  QFile file(filePath);
  if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
    throw std::runtime_error(QStringLiteral("Unable to open project file: %1").arg(filePath).toStdString());
  }

  const auto root = QJsonDocument::fromJson(file.readAll()).object();
  WorkbenchProjectDocument document = createEmpty();
  document.schemaVersion = root.value(QStringLiteral("schemaVersion")).toString(document.schemaVersion);
  document.projectId = root.value(QStringLiteral("projectId")).toString();
  document.displayName = root.value(QStringLiteral("displayName")).toString(document.displayName);
  document.projectFilePath = filePath;
  document.bridgeSnapshotPath = root.value(QStringLiteral("bridgeSnapshotPath")).toString();
  document.lastImportedStepPath = root.value(QStringLiteral("lastImportedStepPath")).toString();
  document.lastImportedDxfPath = root.value(QStringLiteral("lastImportedDxfPath")).toString();
  document.notes = root.value(QStringLiteral("notes")).toString();
  document.metadata = root.value(QStringLiteral("metadata")).toObject();
  document.dirty = false;
  return document;
}

void ProjectFileService::save(WorkbenchProjectDocument& document, const QString& filePath) {
  QFile file(filePath);
  if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate | QIODevice::Text)) {
    throw std::runtime_error(QStringLiteral("Unable to save project file: %1").arg(filePath).toStdString());
  }

  QJsonObject root;
  root.insert(QStringLiteral("schemaVersion"), document.schemaVersion);
  root.insert(QStringLiteral("projectId"), document.projectId);
  root.insert(QStringLiteral("displayName"), document.displayName);
  root.insert(QStringLiteral("bridgeSnapshotPath"), document.bridgeSnapshotPath);
  root.insert(QStringLiteral("lastImportedStepPath"), document.lastImportedStepPath);
  root.insert(QStringLiteral("lastImportedDxfPath"), document.lastImportedDxfPath);
  root.insert(QStringLiteral("notes"), document.notes);
  root.insert(QStringLiteral("metadata"), document.metadata);

  file.write(QJsonDocument(root).toJson(QJsonDocument::Indented));
  document.projectFilePath = filePath;
  document.dirty = false;
}

QString ProjectFileService::promptOpenProject(QWidget* parent) {
  return QFileDialog::getOpenFileName(parent, QStringLiteral("Open CAM project"), {}, QString::fromUtf8(kProjectFilter));
}

QString ProjectFileService::promptSaveProject(QWidget* parent, const QString& currentPath) {
  return QFileDialog::getSaveFileName(parent, QStringLiteral("Save CAM project"), currentPath, QString::fromUtf8(kProjectFilter));
}

QString ProjectFileService::promptImportStep(QWidget* parent) {
  return QFileDialog::getOpenFileName(parent, QStringLiteral("Import STEP model"), {}, QString::fromUtf8(kStepFilter));
}

QString ProjectFileService::promptImportDxf(QWidget* parent) {
  return QFileDialog::getOpenFileName(parent, QStringLiteral("Import DXF drawing"), {}, QString::fromUtf8(kDxfFilter));
}
