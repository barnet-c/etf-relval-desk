/**
 * Thin wrapper over a parsed CSV that keeps the column access helpers used by
 * the plot builders.
 *
 *   new EtfData(rows, n)   n === -1 uses every row
 *
 *   get_val(index, keys, not_string)  value(s) for one row, numeric or label
 *   get_col(keys, not_string)         the same accessor applied down a column
 *   get_values(col_key, target)       every row where col_key === target
 *   group_by(col_key)                 rows bucketed by a column value
 */
export default class EtfData {
  constructor(rows, num = -1) {
    this.data = rows;
    this.keys = rows.length > 0 ? Object.keys(rows[0]) : [];
    this.length = rows.length;
    this.n = num === -1 ? this.length : Math.min(num, this.length);
  }

  get_val(index, d_key, not_string) {
    const row = this.data[index];

    if (not_string) {
      if (d_key.length > 1) {
        return d_key.map((k) => parseFloat(row[k]));
      }
      return parseFloat(row[d_key[0]]);
    }

    return d_key.map((k) => `${k}: ${row[k]}`).join('\n');
  }

  get_col(d_key, not_string) {
    const col = [];
    for (let i = 0; i < this.n; i += 1) {
      col.push(this.get_val(i, d_key, not_string));
    }
    return col;
  }

  get_values(col_key, d_key) {
    return this.data.filter((row) => row[col_key] === d_key);
  }

  group_by(col_key) {
    const groups = {};
    for (let i = 0; i < this.n; i += 1) {
      const row = this.data[i];
      const bucket = row[col_key];
      if (!groups[bucket]) {
        groups[bucket] = [];
      }
      groups[bucket].push(row);
    }
    return groups;
  }
}
