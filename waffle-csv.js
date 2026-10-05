/* Shared strict CSV reader for cached booking exports. */
(function (root, factory) {
  const api = factory();
  if (root) root.WaffleCsv = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function parse(input) {
    const source = String(input == null ? '' : input);
    if (!source) return { ok: true, records: [], error: '' };

    const records = [];
    let fields = [];
    let field = '';
    let state = 'start';
    let recordStart = 0;

    function endRecord(index, ending) {
      fields.push(field);
      records.push({
        cells: fields,
        raw: source.slice(recordStart, index),
        lineEnding: ending
      });
      fields = [];
      field = '';
      state = 'start';
      recordStart = index + ending.length;
    }

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const atStart = index === 0 && char === '\uFEFF';
      if (atStart) continue;

      if (state === 'quoted') {
        if (char === '"') {
          if (source[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            state = 'closed';
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '\r' || char === '\n') {
        if (char === '\r' && source[index + 1] === '\n') {
          endRecord(index, '\r\n');
          index += 1;
        } else {
          endRecord(index, char);
        }
        continue;
      }

      if (state === 'closed') {
        if (char === ',') {
          fields.push(field);
          field = '';
          state = 'start';
          continue;
        }
        return { ok: false, records: [], error: 'Unexpected character after a closing quote.' };
      }

      if (state === 'start') {
        if (char === '"') {
          state = 'quoted';
        } else if (char === ',') {
          fields.push('');
        } else {
          field += char;
          state = 'unquoted';
        }
        continue;
      }

      if (char === '"') {
        return { ok: false, records: [], error: 'Quote found inside an unquoted field.' };
      }
      if (char === ',') {
        fields.push(field);
        field = '';
        state = 'start';
      } else {
        field += char;
      }
    }

    if (state === 'quoted') {
      return { ok: false, records: [], error: 'Unclosed quoted field.' };
    }

    // A final record is present only when source contains data after the last
    // record separator. A trailing newline belongs to the prior record.
    if (recordStart < source.length) {
      fields.push(field);
      records.push({ cells: fields, raw: source.slice(recordStart), lineEnding: '' });
    }

    return { ok: true, records, error: '' };
  }

  function encodeField(value) {
    const text = String(value == null ? '' : value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function serialize(records) {
    return (Array.isArray(records) ? records : [])
      .map(record => String(record.raw == null ? '' : record.raw) + String(record.lineEnding || ''))
      .join('');
  }

  return Object.freeze({ parse, encodeField, serialize });
});
