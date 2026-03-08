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

private:
  QLabel* titleLabel_ = nullptr;
  QLabel* modeLabel_ = nullptr;
  QLabel* selectionLabel_ = nullptr;
  QLabel* integrationStatusLabel_ = nullptr;
};
