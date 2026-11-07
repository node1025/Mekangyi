'use strict';

const { randomBytes } = require('node:crypto');

/** 24-character hex id (same string format as legacy document stores) */
class ObjectId {
  constructor(bytes) {
    this._id =
      typeof bytes === 'string' && /^[a-f0-9]{24}$/i.test(bytes)
        ? bytes.toLowerCase()
        : randomBytes(12).toString('hex');
  }
  toString() {
    return this._id;
  }
  valueOf() {
    return this._id;
  }
  toJSON() {
    return this._id;
  }
  equals(other) {
    return String(this) === String(other);
  }
}

function isObjectIdType(t) {
  return t === ObjectId || t?.name === 'ObjectId';
}

function pluralizeCollection(modelName) {
  const map = {
    User: 'users',
    Product: 'products',
    ProductVariant: 'productvariants',
    Inventory: 'inventories',
    Cart: 'carts',
    Order: 'orders',
    Review: 'reviews',
    Board: 'boards',
    Comment: 'comments',
    PasswordReset: 'passwordresets',
    AdminSession: 'adminsessions'
  };
  if (map[modelName]) return map[modelName];
  const lower = modelName.toLowerCase();
  if (lower.endsWith('y')) return lower.slice(0, -1) + 'ies';
  return lower + 's';
}

function normalizeFieldDef(def) {
  if (def == null) throw new Error('Invalid field definition');
  if (Array.isArray(def)) {
    if (def.length !== 1) throw new Error('Array fields must have exactly one element schema');
    return { type: 'Array', of: def[0] };
  }
  if (typeof def !== 'object' || def instanceof Date || isObjectIdType(def)) {
    return { type: def };
  }
  if (def.type !== undefined) return { ...def };
  return { type: 'Nested', fields: def };
}

/**
 * Collect schema paths (dot notation for nested; array subfields as items.x).
 */
function buildPaths(definition) {
  const paths = new Map();

  function walk(pathName, fieldDef, inArray) {
    const norm = normalizeFieldDef(fieldDef);
    const { type, of, fields, ...opts } = norm;

    if (type === 'Nested' && fields) {
      for (const [k, v] of Object.entries(fields)) {
        walk(pathName ? `${pathName}.${k}` : k, v, inArray);
      }
      return;
    }

    if (type === 'Array' && of && typeof of === 'object' && !Array.isArray(of)) {
      const innerNorm = normalizeFieldDef(of);
      if (innerNorm.type === 'Nested' && innerNorm.fields) {
        paths.set(pathName || 'items', {
          path: pathName || 'items',
          instance: 'Array',
          options: { ...opts, of: innerNorm.fields },
          inArray
        });
        for (const [k, v] of Object.entries(innerNorm.fields)) {
          walk(`${pathName || 'items'}.${k}`, v, true);
        }
        return;
      }
      let elemInstance = 'Mixed';
      const t = innerNorm.type;
      if (t === String || t === 'String') elemInstance = 'String';
      else if (t === Number || t === 'Number') elemInstance = 'Number';
      else if (t === Boolean || t === 'Boolean') elemInstance = 'Boolean';
      else if (t === Date || t === 'Date') elemInstance = 'Date';
      else if (isObjectIdType(t) || t === 'ObjectId') elemInstance = 'ObjectId';

      paths.set(pathName || 'items', {
        path: pathName || 'items',
        instance: 'Array',
        options: { ...opts, of: { ...innerNorm, instance: elemInstance } },
        inArray
      });
      return;
    }

    let instance = 'Mixed';
    if (type === String || type === 'String') instance = 'String';
    else if (type === Number || type === 'Number') instance = 'Number';
    else if (type === Boolean || type === 'Boolean') instance = 'Boolean';
    else if (type === Date || type === 'Date') instance = 'Date';
    else if (isObjectIdType(type) || type === 'ObjectId') instance = 'ObjectId';
    else if (type === 'Array') instance = 'Array';

    paths.set(pathName, { path: pathName, instance, options: { ...opts }, inArray });
  }

  for (const [key, val] of Object.entries(definition)) {
    walk(key, val, false);
  }
  return paths;
}

class Schema {
  constructor(definition, options = {}) {
    this.options = { timestamps: false, ...options };
    this.definition = {
      _id: { type: ObjectId },
      ...definition,
      ...(this.options.timestamps ? { createdAt: { type: Date }, updatedAt: { type: Date } } : {})
    };
    this.paths = buildPaths(this.definition);
    this._indexes = [];
    for (const [name, desc] of this.paths) {
      if (!name.includes('.') && (desc.options.unique || desc.options.index)) this._indexes.push([{ [name]: 1 }, { ...(desc.options.unique ? { unique: true } : {}) }]);
    }
    this._virtuals = new Map();
    this._preSave = [];
    this._preValidate = [];
    this.methods = {};
    this.statics = {};
  }

  eachPath(fn) {
    for (const [, desc] of this.paths) fn(desc.path, desc);
  }

  path(name) {
    return this.paths.get(name);
  }

  index(keys, opts = {}) {
    this._indexes.push([keys, opts]);
  }

  indexes() {
    return this._indexes;
  }

  virtual(name) {
    const self = this;
    return {
      get(fn) {
        self._virtuals.set(name, { ...(self._virtuals.get(name) || {}), get: fn });
        return this;
      }
    };
  }

  pre(event, fn) {
    if (event === 'save') this._preSave.push(fn);
    else if (event === 'validate') this._preValidate.push(fn);
  }

  get hooks() {
    const schema = this;
    return {
      async execPre(event, doc) {
        const list = event === 'save' ? schema._preSave : event === 'validate' ? schema._preValidate : [];
        if (!list.length) return;
        for (const hook of list) {
          await new Promise((resolve, reject) => {
            const next = err => (err ? reject(err) : resolve());
            const ret = hook.call(doc, next);
            if (ret && typeof ret.then === 'function') ret.then(resolve, reject);
          });
        }
      }
    };
  }
}

function validationError(path, message) {
  return Object.assign(new Error(`${path}: ${message}`), {
    name: 'ValidationError',
    errors: { [path]: { message: String(message) } }
  });
}

function validateLeaf(pathHint, instance, value, options) {
  if (value === undefined || value === null || value === '') {
    if (options.required) {
      const msg = Array.isArray(options.required) ? options.required[1] : `${pathHint} is required`;
      throw validationError(pathHint, typeof msg === 'string' ? msg : 'required');
    }
    return;
  }
  if (instance === 'String') {
    if (typeof value !== 'string') throw validationError(pathHint, 'must be string');
    if (options.minlength != null && value.length < options.minlength) {
      throw validationError(pathHint, `min length ${options.minlength}`);
    }
    if (options.maxlength != null && value.length > options.maxlength) {
      throw validationError(pathHint, `max length ${options.maxlength}`);
    }
    if (options.enum && !options.enum.includes(value)) {
      throw validationError(pathHint, `must be one of ${options.enum.join(',')}`);
    }
    if (options.match) {
      const re = Array.isArray(options.match) ? options.match[0] : options.match;
      if (!re.test(value)) {
        throw validationError(pathHint, Array.isArray(options.match) ? options.match[1] : 'format');
      }
    }
  }
  if (instance === 'Number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw validationError(pathHint, 'must be number');
    if (options.min != null) {
      const min = Array.isArray(options.min) ? options.min[0] : options.min;
      if (value < min) throw validationError(pathHint, `min ${min}`);
    }
    if (options.max != null) {
      const max = Array.isArray(options.max) ? options.max[0] : options.max;
      if (value > max) throw validationError(pathHint, `max ${max}`);
    }
    if (options.validate?.validator && !options.validate.validator(value)) {
      throw validationError(pathHint, options.validate.message || 'invalid');
    }
  }
  if (instance === 'ObjectId') {
    const s = String(value);
    if (!/^[a-f0-9]{24}$/i.test(s)) throw validationError(pathHint, 'invalid id');
  }
  if (instance === 'Date') {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) throw validationError(pathHint, 'invalid date');
    if (options.validate?.validator && !options.validate.validator(d)) {
      throw validationError(pathHint, options.validate.message || 'invalid date');
    }
  }
}

function validatePath(desc, value, pathHint, schema) {
  const { instance, options } = desc;
  if (instance === 'Array') {
    if (value === undefined || value === null) {
      if (options.required) throw validationError(pathHint, 'required');
      return;
    }
    if (!Array.isArray(value)) throw validationError(pathHint, 'must be array');
    const of = options.of;
    if (of && typeof of === 'object' && !of.instance) {
      const itemSubPaths = [...schema.paths.keys()].filter(p => p.startsWith(`${pathHint}.`));
      for (let i = 0; i < value.length; i++) {
        const row = value[i];
        if (!row || typeof row !== 'object') throw validationError(`${pathHint}[${i}]`, 'invalid element');
        for (const subPath of itemSubPaths) {
          const fieldInItem = subPath.slice(pathHint.length + 1);
          const p = `${pathHint}[${i}].${fieldInItem}`;
          const sub = schema.paths.get(subPath);
          if (sub) validatePath(sub, row[fieldInItem], p, schema);
        }
      }
      return;
    }
    if (of?.instance) {
      for (let i = 0; i < value.length; i++) {
        validateLeaf(`${pathHint}[${i}]`, of.instance, value[i], of);
      }
    }
    return;
  }
  validateLeaf(pathHint, instance, value, options);
}

function castLeaf(instance, value, options, pathHint) {
  if (value === undefined || value === null) return value;
  if (instance === 'ObjectId') {
    if (value instanceof ObjectId) return value;
    if (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)) return new ObjectId(value);
    throw new Error(`Invalid ObjectId at ${pathHint}`);
  }
  if (instance === 'String') {
    let s = String(value);
    if (options.trim) s = s.trim();
    return s;
  }
  if (instance === 'Number') return Number(value);
  if (instance === 'Boolean') return Boolean(value);
  if (instance === 'Date') {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid date at ${pathHint}`);
    return d;
  }
  return value;
}

function castPath(desc, value, pathHint, schema) {
  const { instance, options } = desc;
  if (instance === 'Array') {
    if (value == null) return value;
    if (!Array.isArray(value)) throw new Error(`Expected array at ${pathHint}`);
    const of = options.of;
    if (of && typeof of === 'object' && !of.instance) {
      const itemSubPaths = [...schema.paths.keys()].filter(p => p.startsWith(`${pathHint}.`));
      return value.map((row, i) => {
        if (!row || typeof row !== 'object') throw new Error(`Invalid array row at ${pathHint}[${i}]`);
        const out = { ...row };
        for (const subPath of itemSubPaths) {
          const fieldInItem = subPath.slice(pathHint.length + 1);
          const sub = schema.paths.get(subPath);
          if (sub && out[fieldInItem] !== undefined) {
            out[fieldInItem] = castPath(sub, out[fieldInItem], `${pathHint}[${i}].${fieldInItem}`, schema);
          }
        }
        if (!out._id) out._id = new ObjectId().toString();
        return out;
      });
    }
    if (of?.instance) {
      return value.map((v, i) => castLeaf(of.instance, v, of, `${pathHint}[${i}]`));
    }
    return value;
  }
  return castLeaf(instance, value, options, pathHint);
}

function getAtPath(obj, pathStr) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function setAtPath(obj, pathStr, value) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts.at(-1)] = value;
}

function applyDefaults(data, schema) {
  const out = { ...data };
  for (const [pathName, desc] of schema.paths) {
    const root = pathName.split('.')[0];
    if (pathName.includes('.')) {
      if (desc.options.default !== undefined && getAtPath(out, pathName) === undefined && !pathName.startsWith('items.')) {
        const d = desc.options.default;
        setAtPath(out, pathName, typeof d === 'function' ? d() : d);
      }
      continue;
    }
    if (desc.instance === 'Array') continue;
    if (out[root] === undefined && desc.options.default !== undefined) {
      const d = desc.options.default;
      out[root] = typeof d === 'function' ? d() : d;
    }
  }
  return out;
}

function castDocument(data, schema) {
  let out = applyDefaults(data, schema);
  for (const [pathName, desc] of schema.paths) {
    const root = pathName.split('.')[0];
    if (!pathName.includes('.')) {
      if (out[root] !== undefined) {
        try {
          out[root] = castPath(desc, out[root], root, schema);
        } catch {
          /* keep raw for partial updates */
        }
      }
    }
  }
  for (const [pathName, desc] of schema.paths) {
    if (!pathName.includes('.') || pathName.startsWith('items.')) continue;
    if (getAtPath(out, pathName) !== undefined) {
      try {
        setAtPath(out, pathName, castLeaf(desc.instance, getAtPath(out, pathName), desc.options, pathName));
      } catch {
        /* keep */
      }
    }
  }
  return out;
}

class Document {
  constructor(data = {}, schema) {
    this._schema = schema;
    this._doc = {};
    this.$sessionValue = null;
    this._populated = {};
    this.isNew = data._id == null;
    const raw = castDocument({ ...data }, schema);
    Object.assign(this._doc, raw);
    if (!this._doc._id) {
      this._id = new ObjectId();
      this._doc._id = this._id.toString();
    } else {
      this._id = new ObjectId(String(this._doc._id));
      this._doc._id = this._id.toString();
    }
    this._modified = new Set();
    if (this.isNew) {
      for (const k of Object.keys(this._doc)) if (k !== '_id') this._modified.add(k);
    }
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === 'symbol' || prop === 'constructor') return Reflect.get(target, prop, receiver);
        if (prop === '_id') return target._id;
        if (typeof target[prop] === 'function') return target[prop].bind(receiver);
        if (prop !== '_doc' && prop !== '_schema' && !String(prop).startsWith('__') && !Object.prototype.hasOwnProperty.call(target, prop)) {
          const v = target._doc[prop];
          if (v !== undefined) return v;
        }
        return Reflect.get(target, prop, receiver);
      },
      set(target, prop, value, receiver) {
        const reserved = new Set([
          '_doc', '_schema', '_id', '_modified', '_populated', '$sessionValue', 'isNew', 'constructor'
        ]);
        if (reserved.has(prop)) {
          target[prop] = value;
          return true;
        }
        target.set(prop, value);
        return true;
      }
    });
  }

  populated(key, val) {
    this._populated[key] = val;
  }

  $__reset() {
    this._modified = new Set();
  }

  /** Same as Mongoose: string primary key */
  get id() {
    return String(this._doc._id);
  }

  isModified(path) {
    if (!path) return this._modified.size > 0;
    return this._modified.has(String(path).split('.')[0]);
  }

  get(path) {
    if (path === '_id') return this._id;
    return getAtPath(this._doc, path);
  }

  set(path, value) {
    const root = String(path).split('.')[0];
    const desc = this._schema.paths.get(path) || this._schema.paths.get(root);
    if (this._populated[root] && !String(path).includes('.')) {
      this._doc[path] = value;
    } else if (desc && !String(path).includes('.')) {
      this._doc[path] = castPath(desc, value, path, this._schema);
    } else if (path.includes('.')) {
      setAtPath(this._doc, path, value);
    } else {
      this._doc[path] = value;
    }
    this._modified.add(root);
  }

  toObject(opt = {}) {
    const { depopulate: _dep = false, virtuals = false } = opt;
    const out = JSON.parse(JSON.stringify(this._doc));
    out._id = String(out._id);
    if (_dep) for (const [path, desc] of this._schema.paths) {
      if (!desc.options.ref) continue;
      const parts = path.split('.');
      const holders = parts.length === 1 ? [out] : out[parts[0]] || [];
      const key = parts.at(-1);
      for (const holder of holders) if (holder[key] && typeof holder[key] === 'object' && holder[key]._id) holder[key] = String(holder[key]._id);
    }
    if (virtuals) {
      for (const [name, { get: getter }] of this._schema._virtuals) {
        if (getter) out[name] = getter.call({ ...this._doc, ...out });
      }
    }
    return out;
  }

  toJSON() {
    return this.toObject();
  }

  async validate() {
    await this._schema.hooks.execPre('validate', this);
    for (const [pathName, desc] of this._schema.paths) {
      if (pathName.includes('.') && pathName.startsWith('items.')) continue;
      let val;
      if (!pathName.includes('.')) val = this._doc[pathName];
      else val = getAtPath(this._doc, pathName);
      try {
        validatePath(desc, val, pathName, this._schema);
      } catch (e) {
        if (e.errors) throw e;
        throw Object.assign(new Error(e.message), { errors: { [pathName]: { message: e.message } } });
      }
    }
  }

  $session(value) {
    if (arguments.length) { this.$sessionValue = value; return this; }
    return this.$sessionValue;
  }
}

function isObjectIdOrHexString(value) {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

function createModel(modelName, schema) {
  const table = pluralizeCollection(modelName);

  class Model extends Document {
    constructor(data) {
      super(data, schema);
    }

    static get modelName() {
      return modelName;
    }

    static get schema() {
      return schema;
    }

    static get collection() {
      return { name: table };
    }

    static hydrate(data) {
      const d = new Model(data);
      d.isNew = false;
      d.$__reset();
      return d;
    }
  }

  Object.assign(Model, schema.statics);
  for (const [name, fn] of Object.entries(schema.methods)) {
    Model.prototype[name] = fn;
  }

  return Model;
}

module.exports = {
  Schema,
  createModel,
  ObjectId,
  isObjectIdOrHexString,
  pluralizeCollection
};
