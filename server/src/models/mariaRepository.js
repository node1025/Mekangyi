// Schema/validation layer is local (mariaSchema); every persisted row and transaction is MariaDB/InnoDB.
// Top-level fields are SQL columns; nested objects and arrays use MariaDB JSON columns.
const db = require('../config/maria');
const { ObjectId } = require('./mariaSchema');
const q = name => { if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error('Invalid SQL identifier'); return `\`${name}\``; };
const scalar = value => value instanceof ObjectId ? value.toString() : value;
const plain = value => JSON.parse(JSON.stringify(value));

module.exports = function repository(Model) {
  const schema = Model.schema;
  const table = Model.collection.name;
  const fields = new Map();
  const indexes = schema.indexes().filter(([, opts]) => !opts.expires);
  schema.eachPath((name, type) => {
    if (type.options.ref && !name.includes('.') && !indexes.some(([keys]) => Object.keys(keys)[0] === name)) indexes.push([{ [name]: 1 }, {}]);
  });
  const indexed = new Set(indexes.flatMap(([keys]) => Object.keys(keys)));
  schema.eachPath((path, type) => {
    const root = path.split('.')[0];
    if (root === '__v') return;
    fields.set(root, path.includes('.') ? 'JSON' : type.instance === 'ObjectId' ? 'CHAR(24)' :
      type.instance === 'Number' ? 'DOUBLE' : type.instance === 'Boolean' ? 'BOOLEAN' :
      type.instance === 'Date' ? 'DATETIME(3)' : type.instance === 'String' ? (indexed.has(root) ? 'VARCHAR(191)' : 'LONGTEXT') : 'JSON');
  });
  function field(path) {
    const [root, ...rest] = path.split('.');
    if (!fields.has(root)) throw new Error(`Unknown field: ${path}`);
    if (!rest.length) return q(root);
    if (!rest.every(p => /^[A-Za-z_][A-Za-z0-9_]*$/.test(p))) throw new Error('Invalid field path');
    return `JSON_UNQUOTE(JSON_EXTRACT(${q(root)}, '$.${rest.join('.')}'))`;
  }
  function filter(query = {}, values = []) {
    const clauses = Object.entries(query).map(([key, value]) => {
      if (key === '$or' || key === '$and') return `(${value.map(part => filter(part, values)).join(key === '$or' ? ' OR ' : ' AND ') || 'FALSE'})`;
      const root = key.split('.')[0];
      // Array membership filters are used for cart/order item identifiers.
      if (key.includes('.') && schema.path(root)?.instance === 'Array') {
        const path = key.split('.').slice(1).join('.');
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(path)) throw new Error('Invalid array path');
        values.push(JSON.stringify(scalar(value)));
        return `JSON_CONTAINS(JSON_EXTRACT(${q(root)}, '$[*].${path}'), ?)`;
      }
      const column = field(key);
      if (value === null) return `${column} IS NULL`;
      if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof ObjectId)) {
        return Object.entries(value).filter(([op]) => op !== '$options').map(([op, operand]) => {
          if (op === '$in') { values.push(...operand.map(scalar)); return operand.length ? `${column} IN (${operand.map(() => '?').join(',')})` : 'FALSE'; }
          if (op === '$regex') { values.push(operand instanceof RegExp ? operand.source : operand); return value.$options?.includes('i') ? `LOWER(${column}) REGEXP LOWER(?)` : `${column} REGEXP ?`; }
          const operator = { $gte: '>=', $gt: '>', $lte: '<=', $lt: '<', $ne: '<>' }[op];
          if (!operator) throw new Error(`Unsupported query operator: ${op}`);
          values.push(scalar(operand)); return `${column} ${operator} ?`;
        }).join(' AND ');
      }
      values.push(scalar(value)); return `${column} = ?`;
    });
    return clauses.length ? clauses.join(' AND ') : 'TRUE';
  }
  function encode(key, value) {
    if (value == null) return null;
    if (fields.get(key) === 'JSON') return JSON.stringify(value);
    if (fields.get(key) === 'DATETIME(3)') {
      const date = value instanceof Date ? value : new Date(value);
      if (!Number.isFinite(date.getTime())) throw new Error('Invalid datetime');
      return date;
    }
    return scalar(value);
  }
  function decode(row) {
    for (const [key, type] of fields) if (type === 'JSON' && typeof row[key] === 'string') row[key] = JSON.parse(row[key]);
    return row;
  }
  async function persist(doc, session, hooks = true) {
    if (hooks) {
      await doc.validate();
      // Execute existing price and password hooks (schema pre-save).
      await schema.hooks.execPre('save', doc);
    }
    if (schema.options.timestamps && hooks) {
      const now = new Date();
      doc.createdAt ||= now;
      doc.updatedAt = new Date(Math.max(now.getTime(), (doc.updatedAt?.getTime() || 0) + 1));
    }
    const data = doc.toObject({ depopulate: true, virtuals: false });
    const columns = [...fields.keys()];
    const connection = session?.connection || db.database();
    try {
      if (doc.isNew) await connection.query(`INSERT INTO ${q(table)} (${columns.map(q)}) VALUES (${columns.map(() => '?')})`, columns.map(k => encode(k, data[k])));
      else await connection.query(`UPDATE ${q(table)} SET ${columns.filter(k => k !== '_id').map(k => `${q(k)} = ?`).join(',')} WHERE _id = ?`, [...columns.filter(k => k !== '_id').map(k => encode(k, data[k])), String(doc._id)]);
    } catch (error) { if (error.errno === 1062) error.code = 11000; throw error; }
    doc.isNew = false;
    doc.$__reset();
    return doc;
  }
  Model.prototype.save = async function(opts = {}) { return persist(this, opts.session || this.$session()); };
  async function populate(doc, specification, select, session) {
    const { path, select: selected } = typeof specification === 'object' ? specification : { path: specification, select };
    const type = schema.path(path);
    const target = db.registry.get(type?.options?.ref);
    if (!target) throw new Error(`Unknown population path: ${path}`);
    const parts = path.split('.');
    const holders = parts.length === 1 ? [doc] : doc[parts[0]] || [];
    const key = parts.at(-1);
    for (const holder of holders) {
      const id = holder[key]?._id || holder[key];
      const result = id ? await target.findById(id).select(selected || '').session(session).lean() : null;
      holder[key] = result;
    }
  }
  Model.prototype.populate = async function(path, select) {
    const obj = this.toObject(); await populate(obj, path, select, this.$session());
    // Mark as populated so Mongoose preserves referenced objects in JSON output.
    const type = schema.path(typeof path === 'string' ? path : path.path);
    const target = db.registry.get(type.options.ref);
    const key = typeof path === 'string' ? path : path.path;
    this.populated(key, this.get(key));
    this.set(key, obj[key] ? target.hydrate(obj[key]) : null);
    return this;
  };
  function project(data, selection) {
    if (!selection) return data;
    const tokens = selection.split(/\s+/).filter(Boolean);
    if (tokens[0]?.startsWith('-')) { for (const token of tokens) delete data[token.slice(1)]; return data; }
    return Object.fromEntries(['_id', ...tokens].filter(k => k in data).map(k => [k, data[k]]));
  }
  class Query {
    constructor(kind, query, update, opts = {}) { Object.assign(this, { kind, query: query || {}, update, opts, populations: [], selection: '', offset: 0 }); }
    session(session) { this.opts.session = session; return this; }
    lean() { this.raw = true; return this; }
    select(value) { this.selection = value; return this; }
    sort(value) { this.order = value; return this; }
    limit(value) { this.maximum = Number(value); return this; }
    skip(value) { this.offset = Number(value); return this; }
    populate(path, select) { this.populations.push([path, select]); return this; }
    then(resolve, reject) { return this.exec().then(resolve, reject); }
    catch(reject) { return this.exec().catch(reject); }
    async exec() {
      const write = ['updateOne', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'].includes(this.kind);
      if (write && !this.opts.session) return db.transaction(session => { this.opts.session = session; return this.exec(); });
      const connection = this.opts.session?.connection || db.database();
      const values = [];
      const where = filter(this.query, values);
      if (this.kind === 'countDocuments') return Number((await connection.query(`SELECT COUNT(*) AS total FROM ${q(table)} WHERE ${where}`, values))[0].total);
      let sql = `SELECT * FROM ${q(table)} WHERE ${where}`;
      if (this.order) sql += ` ORDER BY ${Object.entries(this.order).map(([key, direction]) => `${field(key)} ${direction < 0 ? 'DESC' : 'ASC'}`).join(',')}`;
      const single = !['find', 'deleteMany', 'countDocuments'].includes(this.kind);
      const limit = single ? 1 : this.maximum;
      if (limit != null) { if (!Number.isSafeInteger(limit) || limit < 0 || !Number.isSafeInteger(this.offset) || this.offset < 0) throw new Error('Invalid pagination'); sql += ` LIMIT ${limit} OFFSET ${this.offset}`; }
      if (this.opts.session) sql += ' FOR UPDATE';
      let rows = (await connection.query(sql, values)).map(decode);
      if (this.kind === 'countDocuments') return rows.length;
      if (this.kind.startsWith('delete') || this.kind === 'findOneAndDelete') {
        for (const row of rows) await connection.query(`DELETE FROM ${q(table)} WHERE _id = ?`, [row._id]);
        if (this.kind !== 'findOneAndDelete') return { deletedCount: rows.length };
      }
      if (this.update) {
        if (!rows.length && this.opts.upsert) {
          const initial = Object.fromEntries(Object.entries(this.query).filter(([, val]) => val === null || typeof val !== 'object' || val instanceof ObjectId));
          const doc = new Model(initial);
          applyUpdate(doc, this.update, this.query);
          await persist(doc, this.opts.session);
          rows = [doc.toObject()];
        } else if (rows.length) {
          const before = rows[0];
          const doc = Model.hydrate(before);
          applyUpdate(doc, this.update, this.query);
          await persist(doc, this.opts.session);
          rows = [this.opts.new || this.opts.returnDocument === 'after' ? doc.toObject() : before];
        }
        if (this.kind === 'updateOne') return { matchedCount: rows.length, modifiedCount: rows.length };
        if (this.kind === 'findOneAndUpdate') {
          const row = rows[0] || null;
          if (!row) return null;
          return this.raw ? row : Model.hydrate(row);
        }
      }
      const output = [];
      for (let row of rows) {
        for (const [path, select] of this.populations) await populate(row, path, select, this.opts.session);
        row = project(plain(row), this.selection);
        const doc = this.raw ? row : Model.hydrate(row);
        if (!this.raw) for (const [specification] of this.populations) {
          const path = typeof specification === 'string' ? specification : specification.path;
          const root = path.split('.')[0];
          doc.populated(path, true);
          doc._doc[root] = row[root];
        }
        if (doc.$session) doc.$session(this.opts.session || null);
        output.push(doc);
      }
      return single ? output[0] || null : output;
    }
  }
  function matches(item, query) {
    return Object.entries(query).every(([key, value]) => key === '$or' ? value.some(part => matches(item, part)) : String(item[key]) === String(value));
  }
  function applyUpdate(doc, update, query) {
    for (const [operation, changes] of Object.entries(update)) {
      if (!operation.startsWith('$')) { doc.set(operation, changes); continue; }
      for (let [path, value] of Object.entries(changes)) {
        if (path.includes('.$.')) {
          const root = path.split('.')[0];
          const itemQuery = Object.fromEntries(Object.entries(query).filter(([key]) => key.startsWith(`${root}.`)).map(([key, val]) => [key.slice(root.length + 1), val]));
          const index = doc[root].findIndex(item => matches(item, itemQuery));
          if (index < 0) throw new Error('Array item not found');
          path = path.replace('.$.', `.${index}.`);
        }
        if (operation === '$set') doc.set(path, value);
        else if (operation === '$inc') doc.set(path, (doc.get(path) || 0) + value);
        else if (operation === '$unset') doc.set(path, undefined);
        else if (operation === '$pull') doc.set(path, doc.get(path).filter(item => !matches(item, value)));
        else throw new Error(`Unsupported update operator: ${operation}`);
      }
    }
  }
  for (const kind of ['find', 'findOne', 'findOneAndUpdate', 'updateOne', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'countDocuments']) Model[kind] = (query, update, opts) => new Query(kind, query, update, opts);
  Model.findById = id => Model.findOne({ _id: id });
  Model.findByIdAndUpdate = (id, update, opts) => Model.findOneAndUpdate({ _id: id }, update, opts);
  Model.findByIdAndDelete = id => Model.findOneAndDelete({ _id: id });
  Model.exists = query => Model.findOne(query).select('_id').lean();
  Model.create = async (input, opts = {}) => {
    const results = [];
    for (const data of Array.isArray(input) ? input : [input]) results.push(await new Model(data).save(opts));
    return Array.isArray(input) ? results : results[0];
  };
  Model.insertMany = (input, opts) => Model.create(input, opts);
  // Migration only: retain source IDs, timestamps and existing password hashes verbatim.
  Model.importRows = async (rows, session) => {
    for (const row of rows) { const doc = Model.hydrate(row); doc.isNew = true; await persist(doc, session, false); }
  };
  Model.init = async () => {
    const columns = [...fields].map(([name, type]) => `${q(name)} ${type}${name === '_id' ? ' PRIMARY KEY' : ''}`);
    for (const [i, [keys, opts]] of indexes.entries()) {
      if (Object.keys(keys).every(key => fields.has(key))) columns.push(`${opts.unique ? 'UNIQUE ' : ''}KEY ${q(`idx_${i}`)} (${Object.keys(keys).map(q).join(',')})`);
    }
    await db.database().query(`CREATE TABLE IF NOT EXISTS ${q(table)} (${columns.join(',')}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    const present = new Set((await db.database().query(`SHOW INDEX FROM ${q(table)}`)).map(row => row.Key_name));
    for (const [i, [keys, opts]] of indexes.entries()) {
      if (!present.has(`idx_${i}`) && Object.keys(keys).every(key => fields.has(key))) await db.database().query(`ALTER TABLE ${q(table)} ADD ${opts.unique ? 'UNIQUE ' : ''}INDEX ${q(`idx_${i}`)} (${Object.keys(keys).map(q).join(',')})`);
    }
    return Model;
  };
  db.registry.set(Model.modelName, Model);
  return Model;
};
