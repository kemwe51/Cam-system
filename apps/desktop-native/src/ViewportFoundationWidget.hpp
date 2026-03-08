#pragma once

#include <QWidget>

class QLabel;

class ViewportFoundationWidget final : public QWidget {
  Q_OBJECT

public:
  explicit ViewportFoundationWidget(QWidget* parent = nullptr);

  void setProjectContext(const QString& projectLabel, const QString& bridgeSnapshotPath);
  void setViewerModeLabel(const QString& value);
  void setSelectionStatus(const QString& value);
  void setIntegrationStatus(const QString& value);
  void setDisplayLegend(const QString& value);
  void setDocumentStatus(const QString& value);

private:
  QLabel* titleLabel_ = nullptr;
  QLabel* modeLabel_ = nullptr;
  QLabel* selectionLabel_ = nullptr;
  QLabel* integrationStatusLabel_ = nullptr;
  QLabel* documentStatusLabel_ = nullptr;
  QLabel* displayLegendLabel_ = nullptr;
};
