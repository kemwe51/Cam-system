#include "ViewportFoundationWidget.hpp"

#include <QFrame>
#include <QHBoxLayout>
#include <QLabel>
#include <QVBoxLayout>

ViewportFoundationWidget::ViewportFoundationWidget(QWidget* parent)
  : QWidget(parent) {
  auto* rootLayout = new QVBoxLayout(this);
  rootLayout->setContentsMargins(12, 12, 12, 12);
  rootLayout->setSpacing(12);

  auto* header = new QHBoxLayout();
  titleLabel_ = new QLabel(QStringLiteral("Viewport foundation"), this);
  titleLabel_->setStyleSheet(QStringLiteral("font-size: 18px; font-weight: 600;"));
  modeLabel_ = new QLabel(QStringLiteral("Mode: shaded"), this);
  modeLabel_->setStyleSheet(QStringLiteral("color: #475569;"));
  header->addWidget(titleLabel_);
  header->addStretch(1);
  header->addWidget(modeLabel_);
  rootLayout->addLayout(header);

  auto* frame = new QFrame(this);
  frame->setFrameShape(QFrame::StyledPanel);
  frame->setStyleSheet(QStringLiteral("background: #101828; border: 1px solid #344054; border-radius: 6px;"));

  auto* frameLayout = new QVBoxLayout(frame);
  frameLayout->setContentsMargins(20, 20, 20, 20);
  frameLayout->setSpacing(10);

  auto* headline = new QLabel(QStringLiteral("STEP / OCCT viewer integration foundation"), frame);
  headline->setStyleSheet(QStringLiteral("font-size: 20px; font-weight: 700; color: #f8fafc;"));
  headline->setWordWrap(true);
  frameLayout->addWidget(headline);

#ifdef CAM_DESKTOP_HAS_OCCT
  integrationStatusLabel_ = new QLabel(QStringLiteral("Open CASCADE was found at configure time. This widget is the handoff point for AIS_InteractiveContext, V3d_View, and XDE-backed STEP loading."), frame);
#else
  integrationStatusLabel_ = new QLabel(QStringLiteral("Open CASCADE was not found in this environment. The widget stays explicit about the future handoff points for STEP loading, XDE document mapping, selection sync, and viewport commands."), frame);
#endif
  integrationStatusLabel_->setStyleSheet(QStringLiteral("color: #cbd5e1;"));
  integrationStatusLabel_->setWordWrap(true);
  frameLayout->addWidget(integrationStatusLabel_);

  selectionLabel_ = new QLabel(QStringLiteral("Selection sync: model tree ⇄ features ⇄ operations ⇄ viewport ⇄ inspector"), frame);
  selectionLabel_->setStyleSheet(QStringLiteral("color: #93c5fd; font-weight: 600;"));
  selectionLabel_->setWordWrap(true);
  frameLayout->addWidget(selectionLabel_);

  documentStatusLabel_ = new QLabel(QStringLiteral("Document status: awaiting bridge snapshot or STEP/XDE session metadata."), frame);
  documentStatusLabel_->setStyleSheet(QStringLiteral("color: #cbd5e1;"));
  documentStatusLabel_->setWordWrap(true);
  frameLayout->addWidget(documentStatusLabel_);

  displayLegendLabel_ = new QLabel(QStringLiteral("Display layers: model geometry · feature overlays · operation overlays · future path plans"), frame);
  displayLegendLabel_->setStyleSheet(QStringLiteral("color: #cbd5e1;"));
  displayLegendLabel_->setWordWrap(true);
  frameLayout->addWidget(displayLegendLabel_);

  auto* controls = new QLabel(QStringLiteral("Command surface reserved for fit / orbit / pan / zoom / isolate / hide / show. This milestone wires those commands into the native workbench state and OCCT integration boundary without pretending final viewport rendering is complete."), frame);
  controls->setStyleSheet(QStringLiteral("color: #cbd5e1;"));
  controls->setWordWrap(true);
  frameLayout->addWidget(controls);
  frameLayout->addStretch(1);

  rootLayout->addWidget(frame, 1);
}

void ViewportFoundationWidget::setProjectContext(const QString& projectLabel, const QString& bridgeSnapshotPath) {
  const auto bridgeText = bridgeSnapshotPath.isEmpty()
    ? QStringLiteral("Awaiting native-workbench-v1 bridge snapshot")
    : QStringLiteral("Bridge snapshot: %1").arg(bridgeSnapshotPath);
  titleLabel_->setText(QStringLiteral("%1 — %2").arg(projectLabel, bridgeText));
}

void ViewportFoundationWidget::setViewerModeLabel(const QString& value) {
  modeLabel_->setText(QStringLiteral("Mode: %1").arg(value));
}

void ViewportFoundationWidget::setSelectionStatus(const QString& value) {
  selectionLabel_->setText(value);
}

void ViewportFoundationWidget::setIntegrationStatus(const QString& value) {
  integrationStatusLabel_->setText(value);
}

void ViewportFoundationWidget::setDisplayLegend(const QString& value) {
  displayLegendLabel_->setText(value);
}

void ViewportFoundationWidget::setDocumentStatus(const QString& value) {
  documentStatusLabel_->setText(value);
}
