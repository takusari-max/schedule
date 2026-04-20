/**
 * Code.gs: Web アプリのエントリポイントとスプレッドシート連携メニュー。
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('スケジュール調整')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function onOpen() {
  // 対象スプレッドシートに紐づけた場合にメニューを追加（スタンドアロンでは無害）。
  try {
    SpreadsheetApp.getUi()
      .createMenu('スケジュール調整')
      .addItem('シートをセットアップ', 'setupSpreadsheet')
      .addToUi();
  } catch (e) {
    // スタンドアロン実行時は UI が無いため無視
  }
}
