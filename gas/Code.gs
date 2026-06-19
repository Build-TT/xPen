const TOKEN_PROPERTY = "XPEN_SYNC_TOKEN";

const SHEETS = {
  transactions: "xPen_Transactions",
  categories: "xPen_Categories",
  paymentMethods: "xPen_PaymentMethods",
};

const TRANSACTION_HEADERS = [
  "id",
  "type",
  "date",
  "category",
  "paymentMethodId",
  "amount",
  "note",
  "createdAt",
  "updatedAt",
];

const CATEGORY_HEADERS = ["type", "name"];
const PAYMENT_METHOD_HEADERS = ["id", "name"];

function doGet(e) {
  if (!isAuthorized_(e && e.parameter && e.parameter.token)) {
    return json_({ ok: false, error: "Unauthorized" });
  }

  return json_({
    ok: true,
    payload: readWorkbook_(),
  });
}

function doPost(e) {
  let body = {};

  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (error) {
    return json_({ ok: false, error: "Invalid JSON" });
  }

  if (!isAuthorized_(body.token)) {
    return json_({ ok: false, error: "Unauthorized" });
  }

  if (body.action !== "backup" || !body.payload) {
    return json_({ ok: false, error: "Unsupported action" });
  }

  writeWorkbook_(body.payload);

  return json_({
    ok: true,
    savedAt: new Date().toISOString(),
    counts: {
      transactions: (body.payload.transactions || []).length,
      paymentMethods: (body.payload.paymentMethods || []).length,
      categories:
        ((body.payload.categories || {}).income || []).length +
        ((body.payload.categories || {}).expense || []).length,
    },
  });
}

function readWorkbook_() {
  return {
    app: "xPen",
    version: 2,
    exportedAt: new Date().toISOString(),
    transactions: readObjects_(SHEETS.transactions, TRANSACTION_HEADERS).map(
      normalizeTransaction_,
    ),
    categories: readCategories_(),
    paymentMethods: readObjects_(SHEETS.paymentMethods, PAYMENT_METHOD_HEADERS),
  };
}

function writeWorkbook_(payload) {
  const transactions = Array.isArray(payload.transactions)
    ? payload.transactions
    : [];
  const paymentMethods = Array.isArray(payload.paymentMethods)
    ? payload.paymentMethods
    : [];
  const categories = payload.categories || {};

  writeObjects_(SHEETS.transactions, TRANSACTION_HEADERS, transactions);
  writeObjects_(SHEETS.paymentMethods, PAYMENT_METHOD_HEADERS, paymentMethods);
  writeCategories_(categories);
}

function readCategories_() {
  const rows = readObjects_(SHEETS.categories, CATEGORY_HEADERS);
  const next = { income: [], expense: [] };

  rows.forEach(function (row) {
    if ((row.type === "income" || row.type === "expense") && row.name) {
      next[row.type].push(row.name);
    }
  });

  return next;
}

function writeCategories_(categories) {
  const rows = [];

  ["income", "expense"].forEach(function (type) {
    const values = Array.isArray(categories[type]) ? categories[type] : [];
    values.forEach(function (name) {
      rows.push({ type: type, name: name });
    });
  });

  writeObjects_(SHEETS.categories, CATEGORY_HEADERS, rows);
}

function readObjects_(sheetName, headers) {
  const sheet = getSheet_(sheetName, headers);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  return values
    .filter(function (row) {
      return row.some(function (value) {
        return value !== "";
      });
    })
    .map(function (row) {
      const object = {};
      headers.forEach(function (key, index) {
        object[key] = row[index];
      });
      return object;
    });
}

function writeObjects_(sheetName, headers, objects) {
  const sheet = getSheet_(sheetName, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (!objects.length) {
    return;
  }

  const rows = objects.map(function (object) {
    return headers.map(function (key) {
      return object[key] == null ? "" : object[key];
    });
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function getSheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  const currentHeaders = sheet
    .getRange(1, 1, 1, headers.length)
    .getValues()[0];
  const hasHeaders = currentHeaders.some(function (value) {
    return value !== "";
  });

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function normalizeTransaction_(item) {
  return {
    id: String(item.id || ""),
    type: String(item.type || ""),
    date: formatDateCell_(item.date),
    category: String(item.category || ""),
    paymentMethodId: String(item.paymentMethodId || ""),
    amount: Number(item.amount || 0),
    note: String(item.note || ""),
    createdAt: String(item.createdAt || ""),
    updatedAt: String(item.updatedAt || ""),
  };
}

function formatDateCell_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  return String(value || "");
}

function isAuthorized_(token) {
  const expectedToken = getToken_();
  return Boolean(expectedToken && token && token === expectedToken);
}

function getToken_() {
  return PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
